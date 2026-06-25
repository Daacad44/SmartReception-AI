# Webhook Configuration Guide

## Production Endpoints

| Method | URL | Purpose |
|--------|-----|---------|
| `GET` | `https://api.somreception.botandev.com/api/v1/webhooks/whatsapp` | Meta subscription verification (canonical) |
| `POST` | `https://api.somreception.botandev.com/api/v1/webhooks/whatsapp` | Incoming messages and status events |

Legacy paths (backward compatible):

- `https://api.somreception.botandev.com/webhook`
- `https://api.somreception.botandev.com/api/webhook`
- `https://api.somreception.botandev.com/api/v1/whatsapp/webhook`

Diagnostic: `GET /webhook/status` returns verify token configuration (no secrets).

## Meta Developer Console Setup

1. Open [Meta for Developers](https://developers.facebook.com/) → your app → **WhatsApp** → **Configuration**.
2. Under **Webhook**, click **Edit**.
3. Set **Callback URL** to:
   ```
   https://api.somreception.botandev.com/api/v1/webhooks/whatsapp
   ```
4. Set **Verify token** to:
   ```
   smartreception-verify
   ```
5. Click **Verify and save**.
6. Subscribe to webhook fields:
   - `messages`
7. Under **WhatsApp Business Account**, ensure your phone number is connected.

## Verification Flow (GET)

Meta sends:

```
GET /api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=smartreception-verify&hub.challenge=RANDOM_STRING
```

SmartReception validates:

- `hub.mode` === `subscribe`
- `hub.verify_token` === `WHATSAPP_VERIFY_TOKEN` from environment (default: `smartreception-verify`)

On success: returns `hub.challenge` as plain text with HTTP 200.  
On failure: returns HTTP 403.

## Manual Test

```bash
curl "https://api.somreception.botandev.com/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=smartreception-verify&hub.challenge=123456"
```

Expected response: `123456`

## Required Server Environment

```env
WHATSAPP_VERIFY_TOKEN=smartreception-verify
API_URL=https://api.somreception.botandev.com
WHATSAPP_WEBHOOK_URL=https://api.somreception.botandev.com/api/v1/webhooks/whatsapp
META_APP_SECRET=your-meta-app-secret
WHATSAPP_ACCESS_TOKEN=your-whatsapp-access-token
```

`WHATSAPP_VERIFY_TOKEN` takes priority over `VERIFY_TOKEN`. If both are set, ensure they match or remove `VERIFY_TOKEN`.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Verification fails immediately | DNS/SSL — test with `curl` from outside your network |
| 403 on verification | `WHATSAPP_VERIFY_TOKEN` on Vercel must exactly match Meta console; redeploy after env changes |
| Callback URL couldn't be validated | Host unreachable or wrong verify token; check `/health` and `/webhook/status` |
| `VERIFY_TOKEN` override | Remove stale `VERIFY_TOKEN` on Vercel if it differs from `WHATSAPP_VERIFY_TOKEN` |
| Webhook status "pending" in Settings | Meta must POST to the canonical URL; send a test message after saving webhook |
| Messages not in UI | WhatsApp account connected in Settings for your business |
