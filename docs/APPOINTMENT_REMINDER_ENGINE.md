# Appointment Reminder & Follow-up Engine

## Architecture

```
Appointment Created / Approved / Rescheduled
        │
        ▼
appointments.service.ts
        │
        ├── scheduleAppointmentReminders()  ──► BullMQ (Redis)
        │         ├── reminder-30m (delay: startTime - 30min)
        │         ├── reminder-20m (delay: startTime - 20min)
        │         ├── reminder-10m (delay: startTime - 10min)
        │         └── missed-check   (delay: startTime)
        │
        └── dispatchDualChannelNotification()
                  ├── Email (Resend → noreply@botandev.com)
                  └── WhatsApp (Meta Cloud API)
                          │
                          ▼
              appointment_notifications table
```

## Queue Structure

| Queue | Job Name | Payload | When |
|-------|----------|---------|------|
| `appointment-reminder` | `reminder-30m` | `{ appointmentId, businessId, interval: '30m' }` | 30 min before start |
| `appointment-reminder` | `reminder-20m` | `{ interval: '20m' }` | 20 min before start |
| `appointment-reminder` | `reminder-10m` | `{ interval: '10m' }` | 10 min before start |
| `appointment-reminder` | `missed-check` | `{ interval: 'missed' }` | At appointment start time |
| `appointment-reminder` | `followup-24h` | `{ interval: 'followup-24h' }` | 24h after missed |

Jobs use `attempts: 3` with exponential backoff. Job IDs are deterministic (`{appointmentId}-{interval}`) to prevent duplicates.

## Database Schema

### `appointment_notifications`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| appointment_id | UUID | FK → appointments |
| business_id | UUID | FK → businesses |
| customer_id | UUID | FK → customers |
| channel | ENUM | EMAIL, WHATSAPP, SMS, PUSH |
| notification_type | ENUM | See types below |
| scheduled_at | TIMESTAMP | When job was scheduled |
| sent_at | TIMESTAMP | When delivered |
| status | ENUM | PENDING, SENT, FAILED, SKIPPED |
| error_message | TEXT | Failure reason |

**Unique constraint:** `(appointment_id, notification_type, channel)` — prevents duplicate sends.

### Notification Types

- `APPOINTMENT_CREATED`
- `APPOINTMENT_APPROVED`
- `REMINDER_30_MIN`
- `REMINDER_20_MIN`
- `REMINDER_10_MIN`
- `MISSED_APPOINTMENT`
- `FOLLOW_UP_24H`

## Reminder Workflow

1. **Create** → Email + WhatsApp confirmation immediately; schedule 30/20/10 min + missed jobs
2. **Approve** → Email + WhatsApp approval message
3. **30/20/10 min before** → Worker fires → dual-channel reminder (skipped if cancelled/completed)
4. **At start time** → If status still `SCHEDULED` or `CONFIRMED` → mark `MISSED` → dual-channel missed notification → schedule 24h follow-up
5. **24h after missed** → Dual-channel reschedule prompt

## Status Flow

```
SCHEDULED (pending)
    ↓ approve
CONFIRMED (approved)
    ↓ complete          ↓ missed (auto or manual)
COMPLETED              MISSED
    ↓ cancel
CANCELLED
```

## Dual-Channel Delivery

Every automated notification uses `dispatchDualChannelNotification()` which:

1. Creates/updates tracking rows for EMAIL and WHATSAPP
2. Sends both channels in parallel
3. Marks each channel SENT, FAILED, or SKIPPED
4. Logs incomplete dual-channel deliveries

## Error Handling

- BullMQ retries failed jobs (3 attempts)
- Worker runs `processMissedAppointments()` every 5 minutes as fallback
- Failed channel deliveries stored in `appointment_notifications.error_message`
- Cancel/reschedule removes pending BullMQ jobs via `cancelAppointmentReminderJobs()`

## Dashboard

`GET /api/v1/appointments/:id/notifications` — notification history

Appointment detail sheet → **Alerts** tab shows type, channel, status, sent time.

## Running Workers

Requires `REDIS_URL`. Start with:

```bash
npm run worker -w @smartreception/backend
```

See `docs/WORKER_DEPLOYMENT.md` for production deployment.

## Key Files

| File | Purpose |
|------|---------|
| `appointment-scheduler.service.ts` | BullMQ job scheduling |
| `appointment-notification.service.ts` | Notification orchestration |
| `appointment-dual-channel.service.ts` | Email + WhatsApp dispatcher |
| `appointment-notification.repository.ts` | DB tracking |
| `worker.ts` | BullMQ consumer + missed scan cron |
