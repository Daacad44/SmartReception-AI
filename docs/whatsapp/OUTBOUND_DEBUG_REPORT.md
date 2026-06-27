# WhatsApp Outbound Messaging — Production Debug Report

**Date:** 2026-06-27  
**Issue:** Agent replies from Conversation Inbox not delivered to customers; UI sometimes shows success.

---

## Executive Summary

Inbound WhatsApp worked because webhooks write directly to the database. Agent outbound failed due to **three compounding bugs**:

| # | Root Cause | Impact |
|---|------------|--------|
| 1 | **Async BullMQ queue** for agent sends when `REDIS_URL` is set | API returned `201` before Meta was called; if worker not running, messages stayed `PENDING` forever |
| 2 | **Frontend status mapping** treated `PENDING` and `FAILED` as `sent` | UI showed checkmarks / success even when nothing was delivered |
| 3 | **Fake success path** when no `whatsappAccount` on conversation | Message marked `SENT` in DB without calling Graph API |

AI auto-replies worked (when they did) because `ai-reply.service.ts` calls Graph API **synchronously**. Agent inbox used a different, broken path.

---

## Outbound Flow (Before Fix)

```
Send Button → POST /conversations/:id/messages
  → createMessage (status: PENDING)
  → if REDIS_URL: queue.add('send-message')  ← returns immediately
  → else: sendConversationMessage (sync)
  → if no whatsappAccount: status = SENT      ← fake success
  → return message to frontend (still PENDING or fake SENT)
  → frontend mapMessageStatus: PENDING/FAILED → 'sent'  ← fake UI
```

## Outbound Flow (After Fix)

```
Send Button → POST /conversations/:id/messages
  → resolve WhatsApp account (conversation or business fallback)
  → validate token + E.164 phone
  → createMessage (status: PENDING)
  → sendConversationMessage (always synchronous for agents)
      → POST graph.facebook.com/{version}/{phone_number_id}/messages
      → log full Meta response
      → update DB: SENT only on success, FAILED on error
  → if Meta failed: throw WhatsAppDeliveryError (502) — frontend shows error toast
  → if success: broadcast realtime + return updated message
  → frontend shows real status (pending/sent/delivered/read/failed)
```

---

## Files Changed

### Backend
| File | Change |
|------|--------|
| `conversations.service.ts` | Removed queue for agent sends; sync Graph API; account fallback; throw on failure |
| `whatsapp-outbound.service.ts` | Structured logging; return `{ success, whatsappMsgId, error }` |
| `core/errors.ts` | Added `WhatsAppDeliveryError` (502) |
| `worker.ts` | Log queue delivery failures (legacy queued jobs) |

### Frontend
| File | Change |
|------|--------|
| `useApi.ts` | `mapMessageStatus` preserves `pending` and `failed` |
| `entities.ts` | Message status type includes `pending` \| `failed` |
| `useMutations.ts` | Success toast only after API 201 (confirmed delivery) |
| `ConversationsPage.tsx` | Failed message styling + delivery warning |

---

## Multi-Tenant Verification

- `findConversationWithWhatsApp` loads conversation-scoped `whatsappAccount`
- **New:** Falls back to `findAccountByBusiness(businessId)` and links `whatsappAccountId` if missing
- Access token decrypted via `resolveStoredToken` (AES-256-GCM)
- Recipient: `customer.whatsappId` (raw WhatsApp ID) or normalized `phoneDigits(customer.phone)`

---

## Phone Format

- `phoneDigits()` strips non-digits → E.164 without `+` (e.g. `252612345678`)
- Graph API `to` field receives digits-only format (Meta requirement)

---

## Database Status Lifecycle

| Status | Meaning |
|--------|---------|
| `PENDING` | Record created, Graph API not yet confirmed |
| `SENT` | Meta returned `messages[0].id` |
| `DELIVERED` | Webhook status update |
| `READ` | Webhook status update |
| `FAILED` | Graph API error or webhook failed status |

Messages are **never** marked `SENT` without a successful Meta response.

---

## Production Checklist

1. **WhatsApp connected** in Settings with valid access token
2. **`TOKEN_ENCRYPTION_KEY`** stable across deploys (token decrypt fails if key changes)
3. **Worker** (`npm run worker`) running if using Redis for AI/campaigns (agent sends no longer depend on worker)
4. **Webhook** subscribed to `messages` + `message status` for delivery receipts

---

## Logging

Every agent send logs:

1. `[Outbound] Agent send requested`
2. `[Outbound] Message persisted as PENDING`
3. `[Outbound] WhatsApp Graph API request starting`
4. `[WhatsApp] Graph API response:` (full body)
5. `[Outbound] WhatsApp Graph API success` or `failure`
6. `[Outbound] Agent message delivered`

---

## Security

- No access tokens in API responses
- Graph API errors returned to agent (for debugging) without token leakage
- Business ownership enforced via `requireBusiness` + conversation `businessId` scope

---

## Per-Number Delivery Failures (Meta Error 131047)

**Symptom:** Some phone numbers receive agent replies; others show "Delivery failed" even though the platform previously showed success.

**Root cause:** WhatsApp Cloud API **24-hour customer care session window**. Free-form text messages are only allowed within 24 hours of the customer's last inbound message. Outside that window, Meta returns error **131047** (re-engagement message required).

### Evidence (production)

| Number | Last customer inbound | Agent send | Result |
|--------|----------------------|------------|--------|
| `+252687716299` | Within 24h (active chat) | Agent "Asc" | Delivered (blue checks) |
| `+252612599355` | 2026-06-23 (4+ days ago) | Agent "Asc" 2026-06-27 | Failed — Meta `131047` |

Meta may return HTTP 200 with a `wamid` initially, then asynchronously update status to `FAILED` via webhook. This is why the UI could briefly show success before the failure appeared.

### Fix (session window enforcement)

| File | Change |
|------|--------|
| `whatsapp-session.service.ts` | 24h window check; Meta error parsing (`131047`, `131026`) |
| `conversations.service.ts` | Block agent sends when session closed; expose `whatsappSession` on messages API |
| `ConversationsPage.tsx` | Session-expired banner; disable composer; show Meta error details |

Session detection uses the **latest inbound message across all conversations for the same customer**, which handles duplicate customer records with different phone formats (e.g. `612599355` vs `252612599355`).

### What agents should do

1. **Within 24h of customer message:** Free-form replies work normally.
2. **After 24h:** Customer must send a new WhatsApp message first, **or** use an approved **template message** (Campaigns).
3. **Duplicate conversations:** If a customer messages but the wrong thread shows as expired, merge duplicate customer records or reply in the active thread.

### Meta error codes

| Code | Meaning |
|------|---------|
| `131047` | Re-engagement message — 24h session expired |
| `131026` | Message undeliverable — user may have blocked or opted out |
