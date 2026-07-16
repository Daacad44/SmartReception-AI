# SmartReception-AI — Appointment Engine v2 (Enterprise Appointment Intelligence)

Tracks work for the multi-phase Appointment Engine build (Business Information →
Business Operations Center: Working Hours, Availability, Waitlist, Notifications,
AI Booking). One section per phase, appended as each phase completes.

---

## Phase 0 — Discovery (complete, confirmed)

See prior session summary. Key finding: a previous pass (`docs/business-profile-appointment-engine-report.md`)
already built a real appointment-settings engine (`AppointmentSettings`, `BusinessException`,
`appointment-availability.service.ts`) with timezone-correct slot computation and
booking validation. Decision carried into Phase 1: **extend** that engine rather
than replacing it with brand-new `WorkingHours`/`RecurringRule`/`BusinessCalendarException`
models, per the "don't re-platform / don't touch working code unless required" rule.

---

## Phase 1 — Data Model + Migration ✅

### What was added

New Prisma models (all tenant-scoped via `businessId`, cascade-deleted with the business):

- **`AppointmentSlot`** — materialized, bookable time window. `status` enum
  (`AVAILABLE | BOOKED | FULL | BLOCKED | HELD`), `capacity`/`bookedCount` (supports
  multi-booking slots, e.g. group sessions), `heldUntil` (soft-lock for the waitlist
  flow). Unique on `(businessId, serviceId, startTime)` so a slot can't be
  double-materialized. This is new: the existing engine computed slots virtually
  on every request; this table lets a slot be *held* and gives the waitlist/
  concurrency engine (Phase 2) a row to lock.
- **`WaitlistEntry`** — `customerId?`, `customerPhone`, `serviceId?`, `preferredDate?`,
  `preferredTime?`, `priority`, `status` (`WAITING | NOTIFIED | BOOKED | CANCELLED`),
  `notifiedAt`, `heldSlotId`, `bookedAppointmentId`.
- **`NotificationQueue`** — generic outbound queue: `channel` (`WHATSAPP | EMAIL | SMS`),
  `payload` (Json), `status` (`PENDING | SENT | FAILED | CANCELLED`), `scheduledFor`,
  `retryCount`/`maxRetries`, `relatedType`/`relatedId` (polymorphic link back to a
  waitlist offer, reminder, etc.). SMS channel is modeled but not wired to a real
  provider yet (stub, per spec).
- **`AiBookingLog`** — `intent`, `selectedSlotId`, `slotsCheckedCount`,
  `conflictCheckResult`, `source`, `confidence`, linked to `businessId`/`customerId`/
  `conversationId`. Write path added in Phase 4/6.

Extended existing models (minimal, additive):
- **`Service`** — added `bufferMinutes Int @default(0)` (duration already existed as
  `duration`; kept that name rather than renaming to `durationMinutes` to avoid
  touching every existing caller — documented here instead).
- **`Appointment`** — added nullable `slotId` (FK → `AppointmentSlot`, `onDelete: SetNull`,
  indexed). Did **not** add a duplicate `customerPhone` column — `Appointment.primaryPhone`
  already serves that purpose and `Customer.phone` is the source of truth.
- **`Business`**, **`Customer`**, **`Service`** — new relation fields for the above.

### Explicitly *not* added (design decision)

- **`WorkingHours`** / **`RecurringRule`** / **`BusinessCalendarException`** as separate
  models — `AppointmentSettings.weeklyHours` (Json) and `BusinessException` already
  cover this ground. Phase 3 will extend the `weeklyHours` JSON *shape* (application-level,
  no migration needed since it's a `Json` column) to support multiple shifts per day —
  see Phase 3 notes when that lands.
- New `AppointmentStatus` values — the existing enum already has
  `CONFIRMED | CANCELLED | COMPLETED | NO_SHOW | RESCHEDULED` plus more; reused as-is.

### Migration

`backend/prisma/migrations/20260716000000_appointment_engine_v2_data_model/migration.sql`

- 4 new enums: `AppointmentSlotStatus`, `WaitlistStatus`, `NotificationQueueChannel`,
  `NotificationQueueStatus` (guarded `DO $$ ... EXCEPTION duplicate_object` blocks,
  matching the existing migration style in this repo).
- 2 additive columns: `services.bufferMinutes`, `appointments.slotId` (both
  `ADD COLUMN IF NOT EXISTS`).
- 4 new tables: `appointment_slots`, `waitlist_entries`, `notification_queue`,
  `ai_booking_logs` (`CREATE TABLE IF NOT EXISTS`).
- All new indexes `CREATE INDEX IF NOT EXISTS`; all new FKs guarded the same way as
  the enums. Fully idempotent/forward-only, consistent with every other migration
  in this repo, safe to run against the live VPS Postgres via the existing
  `prisma migrate deploy` step.

**How the migration was produced and verified (no destructive steps taken against
any real database):** installed `postgresql-16` + `postgresql-16-pgvector` locally,
replayed all 52 existing migrations from a clean database to reach the exact schema
the production DB is on, then generated a diff against the updated `schema.prisma`
and hand-curated it down to only the statements belonging to this change (the raw
diff also contained pre-existing, unrelated drift — index-name truncation and a
few FK/default mismatches from earlier migrations — which was left untouched per
the "don't touch unrelated code" rule). Applied the curated migration to the local
DB, re-diffed to confirm zero remaining drift from the new models, ran
`prisma generate`, and typechecked + ran the full existing backend test suite.

### Verification

- `prisma validate` ✅
- `prisma migrate deploy` (53 migrations) applied cleanly to a from-scratch local
  Postgres 16 + pgvector database ✅
- Post-migration `prisma migrate diff` shows **zero** drift attributable to this
  change (remaining diff output is pre-existing and unrelated) ✅
- `prisma generate` ✅
- `packages/shared` build (`tsc`) ✅
- `backend` `tsc --noEmit` ✅ (zero errors)
- Backend test suite: **61/61 passing, 0 regressions**

### Files created/changed

**Created**
- `backend/prisma/migrations/20260716000000_appointment_engine_v2_data_model/migration.sql`
- `PROGRESS.md` (this file)

**Changed**
- `backend/prisma/schema.prisma` — 4 new enums, 4 new models, `Service.bufferMinutes`,
  `Appointment.slotId` (+ index + relation), relation fields on `Business`/`Customer`/`Service`.

No application code (services/routes/UI) touched yet — that begins in Phase 2.
