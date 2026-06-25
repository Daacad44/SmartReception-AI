# Security Report — WhatsApp Integration

## Overview

This report documents security controls implemented for the WhatsApp Cloud API integration in SmartReception AI.

## Webhook Authentication

### Meta Verification (GET)

- Validates `hub.mode === subscribe`
- Compares `hub.verify_token` against server-side `VERIFY_TOKEN`
- Returns challenge only on match; otherwise HTTP 403
- Verification attempts are logged

### Payload Integrity (POST)

- **X-Hub-Signature-256** validated using HMAC-SHA256
- Secret sourced from `META_APP_SECRET` or `WHATSAPP_APP_SECRET`
- Uses `crypto.timingSafeEqual` to prevent timing attacks
- Missing or invalid signatures → HTTP 403, request rejected
- If no app secret is configured, verification is skipped with a warning (development only — **not recommended for production**)

## Replay Attack Prevention

- Every webhook message and status event is recorded in `whatsapp_webhook_events`
- `eventId` (WhatsApp message/status ID) has a unique index
- Duplicate events are ignored before processing
- Prevents double-saving messages or re-triggering AI on retries

## Credential Storage

| Secret | Storage | Exposure |
|--------|---------|----------|
| Access tokens | `.env` + `whatsapp_accounts.accessToken` (per business) | Server only |
| App secret | `.env` only | Server only |
| Verify token | `.env` only | Returned to authenticated admins via Settings API |
| JWT secrets | `.env` only | Server only |

- No credentials are hardcoded in source code
- `.env` is in `.gitignore`
- Frontend never receives WhatsApp access tokens in API responses (account list excludes token)

## API Authorization

WhatsApp management endpoints require:

- Valid JWT (`authenticate` middleware)
- Active business context (`requireBusiness`)
- Permissions: `settings:read` / `settings:write`

Webhook endpoints are public (required by Meta) but protected by signature verification.

## Raw Body Handling

Webhook signature verification requires the raw request body. Express is configured to capture `rawBody` for `/api/v1/webhooks/whatsapp` before JSON parsing, ensuring the HMAC matches Meta's computation.

## Media Security

- Inbound media downloaded using business access token
- Stored in private Supabase bucket `whatsapp-media`
- Access via time-limited signed URLs (7 days)
- Bucket is not public

## Audit Trail

The following actions create `audit_logs` entries:

- Inbound WhatsApp message received
- WhatsApp account connected / disconnected

## Rate Limiting & Resilience

- Graph API calls retry on HTTP 429 with `Retry-After` header
- Exponential backoff on network failures (up to 3 attempts)
- Webhook processing is async — Meta receives 200 immediately to avoid retry storms

## Recommendations for Production

1. **Always set** `META_APP_SECRET` — never run production without signature verification
2. Use a strong, random `VERIFY_TOKEN` (32+ characters)
3. Rotate access tokens per Meta best practices; update via Settings or env
4. Enable Redis for queue isolation between webhook ingestion and outbound sends
5. Restrict Supabase service role key to backend only
6. Monitor `audit_logs` and application logs for repeated 403 webhook rejections

## Threat Model Summary

| Threat | Mitigation |
|--------|------------|
| Forged webhooks | HMAC signature verification |
| Replay attacks | Unique eventId deduplication |
| Token leakage | Env-only storage, no frontend exposure |
| Unauthorized account changes | JWT + RBAC permissions |
| Media exfiltration | Private bucket + signed URLs |
