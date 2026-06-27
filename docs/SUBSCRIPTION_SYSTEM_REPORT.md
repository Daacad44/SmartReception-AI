# SmartReception AI — Enterprise Subscription & License System

## 1. Subscription Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SUPER ADMIN (platform:admin)                 │
│  /admin/subscriptions  →  Assign / Extend / Suspend / Unlock     │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              business_subscriptions (source of truth)            │
│  planId · status · activatedAt · expiresAt · paymentStatus       │
└───────────────┬─────────────────────────────┬───────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────────┐
│ businesses (denormalized)  │   │ subscriptions (legacy Stripe)   │
│ licenseStatus              │   │ plan limits for feature caps      │
│ isLicenseLocked            │   └─────────────────────────────────┘
└───────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Tenant API: authenticate → requireBusiness → requireValidLicense │
│ WhatsApp / AI / Email automations: license gate before send      │
└─────────────────────────────────────────────────────────────────┘
```

- **Super Admin only** assigns and modifies licenses.
- **Business owners** can view usage/billing read-only; cannot purchase, upgrade, or extend.
- **Payment providers** plug in later via `paymentStatus` + webhook handlers without changing license logic.

---

## 2. Database Changes

| Table | Purpose |
|-------|---------|
| `subscription_plans` | Catalog (FREE → ENTERPRISE) |
| `business_subscriptions` | Active license per business (1:1) |
| `subscription_history` | Historical snapshots per action |
| `subscription_notifications` | Scheduled/sent reminders |
| `subscription_activity_logs` | Audit trail with old/new values |

**Business columns added:**
- `licenseStatus` — PENDING \| TRIAL \| ACTIVE \| SUSPENDED \| EXPIRED \| CANCELLED
- `isLicenseLocked` — fast lockdown flag

**Migration:** `20250703000000_enterprise_subscription_license`

---

## 3. API Endpoints

### Super Admin (`/api/v1/super-admin/subscriptions`)

| Method | Path | Action |
|--------|------|--------|
| GET | `/plans` | List subscription plans |
| GET | `/` | List businesses + subscription status (search/filter) |
| GET | `/:businessId` | Detail + history + activity + notifications |
| POST | `/:businessId/assign` | Assign plan + duration |
| POST | `/:businessId/extend` | Extend by N days |
| POST | `/:businessId/shorten` | Shorten by N days |
| POST | `/:businessId/pause` | Pause (suspend) |
| POST | `/:businessId/resume` | Resume |
| POST | `/:businessId/suspend` | Suspend business |
| POST | `/:businessId/reactivate` | Reactivate |
| POST | `/:businessId/cancel` | Cancel subscription |
| POST | `/:businessId/unlock` | Temporary unlock |
| POST | `/:businessId/upgrade` | Upgrade plan |
| POST | `/:businessId/downgrade` | Downgrade plan |
| POST | `/:businessId/notes` | Add internal note |

### Tenant (no license middleware)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/billing/license` | License status for expired page |
| GET | `/api/v1/subscription/status` | Same via subscription module |

### Blocked for tenants

- `POST /billing/change-plan` → 403
- `POST /billing/checkout` → 403
- `POST /billing/portal` → 403

---

## 4. Scheduler Jobs

| Job | Interval | Handler |
|-----|----------|---------|
| Expiration Checker | 60s | `processExpiredSubscriptions()` |
| Reminder Dispatcher | 60s | `processDueReminders()` |

Runs in **BullMQ worker process** (`worker.ts`) when `REDIS_URL` is set.

---

## 5. Queue Workers

Queue names registered (future BullMQ repeatable jobs):

- `subscription-expiration`
- `subscription-reminder`
- `subscription-lock`
- `subscription-notification`

Current implementation uses worker `setInterval` scans (same pattern as missed-appointment fallback).

---

## 6. Security Validation

**Middleware chain for tenant routes:**
```
authenticate → requireBusiness → requireValidLicense
```

**Bypass:**
- Super Admin (`platform:admin`)
- Impersonation mode
- Auth, webhooks, `/billing/license`, `/subscription/status`

**Response when invalid:**
```json
HTTP 403
{ "success": false, "error": "Subscription expired", "code": "SUBSCRIPTION_EXPIRED" }
```

**WhatsApp:** `handleIncomingMessage` returns early — no AI, no automation, no reply.

**Email:** Appointment dual-channel notifications blocked when license invalid.

---

## 7. Notification Flow

On **assign/extend**, `scheduleSubscriptionReminders()` creates pending notifications:

| Type | Offset before expiry |
|------|---------------------|
| REMINDER_7D | 7 days |
| REMINDER_3D | 3 days |
| REMINDER_2D | 2 days |
| REMINDER_1D | 1 day |
| REMINDER_12H | 12 hours |
| REMINDER_6H | 6 hours |
| REMINDER_1H | 1 hour |

**Channels:** Email (Resend `noreply@botandev.com`) + WhatsApp Cloud API  
**Future:** SMS, Push (enum ready)

---

## 8. Expiration Flow

1. Worker finds `expiresAt <= now` with status ACTIVE/TRIAL
2. Sets `business_subscriptions.status = EXPIRED`
3. Sets `businesses.licenseStatus = EXPIRED`, `isLicenseLocked = true`
4. Syncs legacy `subscriptions.status = EXPIRED`
5. Logs `EXPIRED` in `subscription_activity_logs`

---

## 9. Business Lock Flow

When locked (EXPIRED, SUSPENDED, CANCELLED, PENDING):

| Module | Behavior |
|--------|----------|
| Dashboard, CRM, KB, etc. | API 403 |
| WhatsApp inbound | Saved optionally; **no AI reply** |
| Appointment emails/WhatsApp | Blocked |
| Campaign workers | Blocked via API middleware |
| Login | Allowed |
| Frontend | Redirect to `/subscription-expired` |

**Super Admin unlock:** `POST .../unlock` → ACTIVE + `isLicenseLocked = false`

---

## 10. Future Payment Integration Points

| Integration point | Field / hook |
|-------------------|--------------|
| Payment received | Set `paymentStatus = PAID`, call `assignSubscription` or `extendSubscription` |
| Payment failed | `paymentStatus = FAILED`, optional suspend |
| Provider webhook | New module `payment-webhook.service.ts` → subscription service (no license logic change) |
| Providers | EVC Plus, eDahab, Sahal, Premier Wallet, Zaad, Bank APIs, Stripe, PayPal |

`SubscriptionPaymentStatus` enum: `NOT_APPLICABLE | PENDING | PAID | FAILED | REFUNDED`

---

## Frontend

| Route | Audience |
|-------|----------|
| `/admin/subscriptions` | Super Admin control panel |
| `/subscription-expired` | Locked business users |
| `/billing` | Read-only usage + license info |

---

## Deployment Notes

1. Run migration: `npm run db:migrate -w @smartreception/backend`
2. Ensure worker process running with Redis for expiration/reminders
3. Super Admin assigns licenses for existing businesses (migration auto-migrates from legacy `subscriptions` table)
