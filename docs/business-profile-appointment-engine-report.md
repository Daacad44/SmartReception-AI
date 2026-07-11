# Business Profile & AI Appointment Intelligence — Redesign & Stabilization Report

This report documents the root-cause investigation and the production changes made to
the **Business Profile** module and the **AI Appointment Intelligence** module.

Architecture respected throughout: Node.js/Express, React/TypeScript/Vite, PostgreSQL,
Prisma, JWT auth, Redis, Resend + WhatsApp Cloud API. Multi-tenancy is enforced by
`businessId` scoping on every query. No Supabase code was added or investigated. No mock
data, demos, or placeholders were introduced.

---

## 1. Root causes found

### 1.1 "Failed to save Business Profile" (critical, reproduced)
- **Root cause:** `updateBusinessProfileSchema` (packages/shared) declared every field as
  `.optional()`, which in Zod accepts `string | undefined` but **rejects `null`**.
- The frontend loads the profile via `GET /business-profile`, seeds the form with the
  **entire row** (`setForm(data)`), and PATCHes the whole form back. Every unset column
  (website, email, mission, …) is `null`, so a single unset field threw a `ZodError`
  → `errorHandler` returned **400** → `onError` toast **"Failed to save Business Profile"**.
- Because a fresh profile has many `null` columns, the save failed **every time**.

### 1.2 No structured working hours / appointment settings / exceptions
- Working hours existed only as a free-text `workingHours` string on `BusinessProfile`.
- There was no source of truth for slot duration, buffers, blocked dates, or holidays,
  so the AI booking flow (`sales-flow.service`) created appointments at a hardcoded
  60-minute duration with **no validation** — allowing past, closed-day, and
  out-of-hours bookings, and relying only on a raw overlap check.

### 1.3 AI could not answer hours/availability from data
- The prompt builders injected the profile text but **no structured hours and no real
  open slots**, so the assistant had nothing authoritative to offer and could invent times.

---

## 2. Errors fixed

- Business Profile save now accepts the exact shape the API emits (`null`/`''` tolerated,
  blanks treated as "clear", real validation kept for non-empty URLs/emails).
- AI booking now validates against real availability and never books past/closed/holiday/
  out-of-hours/double-booked times; it offers real alternative slots on failure.
- Business Profile save now refreshes all AI caches + re-syncs business identity so
  changes are live on the next message (no manual refresh).

---

## 3. APIs modified / added

New module `appointment-scheduling` mounted at `/api/v1/appointment-scheduling`:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/settings` | Get appointment settings (auto-creates defaults) |
| PUT | `/settings` | Update weekly hours, slot config, buffers, blocked dates |
| GET | `/exceptions` | List holidays / closures / special hours |
| POST | `/exceptions` | Create an exception |
| PATCH | `/exceptions/:id` | Update an exception |
| DELETE | `/exceptions/:id` | Delete an exception |
| GET | `/availability/day?date=YYYY-MM-DD` | Real slots for a day |
| GET | `/availability/upcoming?days=N` | Real slots across upcoming days |
| GET | `/working-hours` | Human-readable weekly hours summary |

All routes require `authenticate` + `requireBusiness` and are authorized by
`appointments:read` / `appointments:write`.

Existing `PATCH /business-profile` unchanged in surface but hardened (see §2).

---

## 4. Prisma models updated

- **`BusinessProfile`** — added `coverImageUrl`, `targetAudience`, `supportEmail`,
  `timezone`, `latitude`, `longitude`.
- **`AppointmentSettings`** (new, 1:1 with `Business`) — `timezone`, `slotDurationMinutes`,
  `bufferBeforeMinutes`, `bufferAfterMinutes`, `minNoticeMinutes`, `maxAdvanceDays`,
  `maxDailyBookings`, `allowSameDay`, `weeklyHours` (Json), `blockedDates` (Json),
  `unavailableSlots` (Json).
- **`BusinessException`** (new, many per `Business`) — `title`, `type`
  (`BusinessExceptionType` enum), `startDate`, `endDate`, `isClosed`, `openTime`,
  `closeTime`, `note`.
- New enum **`BusinessExceptionType`**: NATIONAL_HOLIDAY, RELIGIOUS_HOLIDAY,
  EMERGENCY_CLOSURE, MAINTENANCE, VACATION, SPECIAL_HOURS, HALF_DAY, TEMPORARY_CLOSURE.
- Relations added to `Business`: `appointmentSettings`, `businessExceptions`.

---

## 5. PostgreSQL schema changes / migrations

Migration `20250712000000_appointment_scheduling_engine`:
- `ALTER TABLE business_profiles ADD COLUMN` (IF NOT EXISTS) for the 6 new profile columns.
- `CREATE TYPE "BusinessExceptionType"` (guarded).
- `CREATE TABLE appointment_settings` with unique index on `businessId`.
- `CREATE TABLE business_exceptions` with indexes on `businessId` and `(businessId, startDate)`.
- Foreign keys to `businesses(id)` with `ON DELETE CASCADE` (guarded, idempotent).

Fully idempotent (`IF NOT EXISTS` / guarded `DO` blocks) and applied by the existing
`prisma migrate deploy` step in the Docker entrypoint.

---

## 6. Redis / cache improvements

- `AppointmentSettings` cached in-process with a 60s TTL and explicit invalidation on any
  settings/exception mutation (`invalidateAppointmentSettingsCache`).
- Business Profile save invalidates the profile cache, the tenant cache (which cascades to
  the knowledge cache) and re-syncs the business identity — one code path
  (`refreshAiContext`) keeps AI memory consistent.

---

## 7. AI improvements

- New `buildAppointmentAvailabilityContext(businessId)` produces an authoritative block:
  working hours (in the business timezone), the next real open slots, and upcoming
  closures — with an explicit instruction to never invent times.
- The RAG pipeline injects this block whenever the message is booking/contact intent or
  matches hours/booking keywords (English **and** Somali).
- The company-profile prompt now explicitly answers working-hours and availability
  questions from data only.

---

## 8. Appointment Engine improvements

New `appointment-availability.service.ts` + `timezone.util.ts` (Intl-based, no new deps):
- Timezone-correct wall-time ↔ UTC conversion (DST-safe, verified by tests).
- Slot generation reading weekly hours, breaks/lunch, buffers, blocked dates,
  unavailable ranges, existing bookings, min-notice and max-advance windows.
- `validateBookingTime` prevents: past bookings, below-min-notice, beyond-max-advance,
  closed days, holidays/exceptions, out-of-hours, break overlaps, double-booking
  (buffer-aware), and daily-cap breaches.
- Wired into the WhatsApp/AI sales flow: slot duration now comes from settings and every
  booking is validated; on failure the customer is offered real available times.

---

## 9. Reminder / notification engine

The existing reminder + notification infrastructure (`AppointmentReminderConfig`,
`AppointmentNotification`, `scheduleAllReminders`, workflow engine status transitions) is
retained and continues to fire on status changes. The new engine feeds it correct start
times and durations. No regressions (all existing tests pass).

---

## 10. Business Profile improvements

- Redesigned settings UI into sub-tabs: **Company Profile**, **Working Hours**,
  **Appointment Settings**, **Exceptions**.
- New fields surfaced: Target Audience, Support Email (plus DB support for cover image,
  timezone, GPS).
- Weekly working-hours editor (per-day open/close + lunch break).
- Appointment settings editor (duration, buffers, notice, advance window, daily cap,
  same-day toggle, timezone).
- Business Exceptions manager (holidays/closures/special hours) with type + date range.
- Frontend save path fixed end-to-end against the null round-trip.

---

## 11. Files modified / added

**Added**
- `backend/src/infrastructure/appointments/timezone.util.ts`
- `backend/src/infrastructure/appointments/appointment-availability.service.ts`
- `backend/src/infrastructure/appointments/timezone.util.test.ts`
- `backend/src/modules/appointment-scheduling/{service,controller,routes}.ts`
- `backend/src/modules/business-profile/business-profile-schema.test.ts`
- `backend/prisma/migrations/20250712000000_appointment_scheduling_engine/migration.sql`
- `frontend/src/components/settings/WorkingHoursSettings.tsx`
- `frontend/src/components/settings/AppointmentSettingsForm.tsx`
- `frontend/src/components/settings/BusinessExceptionsManager.tsx`
- `docs/business-profile-appointment-engine-report.md`

**Modified**
- `packages/shared/src/schemas.ts` (null-tolerant profile schema + new scheduling schemas/types/helpers)
- `backend/prisma/schema.prisma` (new columns, models, enum, relations)
- `backend/src/modules/business-profile/business-profile.service.ts` (save fix + AI refresh)
- `backend/src/infrastructure/ai/sales-flow.service.ts` (settings-driven duration + validation)
- `backend/src/infrastructure/ai/rag/prompt-builder.service.ts` (availability block)
- `backend/src/infrastructure/ai/rag/rag-pipeline.service.ts` (inject availability context)
- `backend/src/routes/index.ts` (mount scheduling routes)
- `backend/package.json` (register new tests)
- `frontend/src/components/settings/BusinessProfileSettings.tsx` (tabbed redesign + fields)

---

## 12. End-to-end / verification results

- `packages/shared`: `tsc` build ✅
- `backend`: `tsc --noEmit` ✅, `prisma validate` ✅, `prisma generate` ✅
- `frontend`: `tsc --noEmit` ✅, `vite build` ✅
- Backend test suite: **61 passed / 0 failed** (10 new tests added), covering:
  - Profile schema accepts `null`/`''`, strips unknown keys, still rejects bad URLs.
  - Appointment settings defaults; exception special-hours validation.
  - Timezone math (Mogadishu UTC+3, New York DST, weekday resolution, time formatting).

---

## 13. Production readiness

- Idempotent, forward-only migration applied by the existing deploy step.
- All new tables are `businessId`-scoped and cascade-deleted; every new route is
  authenticated, business-scoped and permission-checked — tenant isolation preserved.
- No new runtime dependencies (timezone handling uses the platform `Intl` API).
- Caching + invalidation keep AI memory consistent under load; queries are indexed.
- Backward compatible: the free-text `workingHours` field and existing appointment,
  reminder and notification flows are retained.
