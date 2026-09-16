# Campaign Center — Resend Failed

## Changelog

Campaign Center can retry **failed recipients only** without resending people who already received the broadcast.

### Backend

- `POST /api/v1/campaigns/:id/retry-failed` (`campaigns:write`)
  - Resets `FAILED` recipients that are still retryable (`PENDING`, `isSent: false`, new `runVersion`)
  - Skips opted-out customers, empty phones, and permanent failures (`131026`, blocked, invalid number, opted out)
  - Does **not** skip `131047` (24-hour session) — those retry with a Meta template when the session is closed
  - Does **not** call `executeCampaignSend` (that path skips one-time campaigns that already sent)
  - Reuses `enqueueCampaignBatches`
  - Max **3** retries, **5-minute** cooldown
  - Counts against monthly send quota; does **not** count as a new active campaign
- `Campaign.retryCount` / `Campaign.lastRetryAt` (migration `20260916000000_campaign_retry_failed`)
- Batch send is session-aware: open 24h window (or media) keeps the original type; closed TEXT/TEMPLATE uses `template.whatsappTemplateName`, a Meta slug name, or the WhatsApp account re-engagement template. No template → fail that recipient with a session-expired reason (not a silent skip of the whole campaign)
- Finalize counts **all** recipients (not only the current `runVersion`) so prior successes stay in stats. Partial retries do not increment `runsCompleted` or reset every recipient on a recurring campaign
- Delivery webhooks reclassify `FAILED` → `COMPLETED` when `sentCount > 0`

### Frontend

- **Resend Failed** on broadcast cards when `failedCount > 0` and the campaign is not `RUNNING` / `SENDING` / `ARCHIVED` / `CANCELLED`
- Confirm dialog before send
- Retry history: “Retried N times · Last retry …”
- Button disabled at max retries or during the cooldown

## Test checklist

- [ ] Failed recipient is retried; Graph/template send is attempted again
- [ ] Successful recipients (`SENT` / `DELIVERED` / `READ`) are **not** resent
- [ ] Opted-out, blocked (`131026`), and invalid numbers are skipped
- [ ] Session-expired (`131047`) recipients retry as a Meta template when one is configured; otherwise they fail with a clear session-expired reason
- [ ] Campaign status becomes `COMPLETED` if every previously-failed retry succeeds, or `FAILED` / mixed if some still fail
- [ ] Stats (`sentCount` / `failedCount`) match live recipient rows after retry
- [ ] Retry history increments; a fourth retry is rejected; a retry inside 5 minutes is rejected
- [ ] Confirm dialog appears; cancel does not send
- [ ] `RUNNING` / `SENDING` campaigns do not show Resend Failed
