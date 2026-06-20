# Webhook Configuration Guide

## Production Endpoints

| Method | URL | Purpose |
|--------|-----|---------|
| `GET` | `https://somreception.botandev.com/webhook` | Meta subscription verification |
| `POST` | `https://somreception.botandev.com/webhook` | Incoming messages and status events |

Alternate path (same handler): `https://somreception.botandev.com/api/webhook`

Legacy paths (backward compatible): `/api/v1/webhooks/whatsapp`, `/api/v1/whatsapp/webhook`

> **Important:** `api.somreception.botandev.com` does not resolve in DNS unless you add a CNAME record pointing to Vercel. Use `somreception.botandev.com/webhook` in Meta until the API subdomain is configured.

## Meta Developer Console Setup

1. Open [Meta for Developers](https://developers.facebook.com/) → your app → **WhatsApp** → **Configuration**.
2. Under **Webhook**, click **Edit**.
3. Set **Callback URL** to:
   ```
   https://somreception.botandev.com/webhook
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
GET /webhook?hub.mode=subscribe&hub.verify_token=smartreception-verify&hub.challenge=RANDOM_STRING
```

SmartReception validates:

- `hub.mode` === `subscribe`
- `hub.verify_token` === `WHATSAPP_VERIFY_TOKEN` from environment (default: `smartreception-verify`)

On success: returns `hub.challenge` as plain text with HTTP 200.  
On failure: returns HTTP 403.

## Manual Test

```bash
curl "https://somreception.botandev.com/webhook?hub.mode=subscribe&hub.verify_token=smartreception-verify&hub.challenge=123456"
```

Expected response: `123456`

## Required Server Environment

```env
WHATSAPP_VERIFY_TOKEN=smartreception-verify
VERIFY_TOKEN=smartreception-verify
API_URL=https://somreception.botandev.com
WHATSAPP_WEBHOOK_URL=https://somreception.botandev.com/webhook
META_APP_SECRET=your-meta-app-secret
```

## Optional: API Subdomain

To use `https://api.somreception.botandev.com/webhook`:

1. In Vercel → Project → Settings → Domains, add `api.somreception.botandev.com`
2. In your DNS provider, add CNAME: `api.somreception.botandev.com` → `cname.vercel-dns.com`
3. Set `API_URL=https://api.somreception.botandev.com` and `WHATSAPP_WEBHOOK_URL=https://api.somreception.botandev.com/webhook`

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Verification fails immediately | DNS — can Meta resolve your callback host? Test with `curl` |
| 403 on verification | `WHATSAPP_VERIFY_TOKEN` on server must exactly match Meta console |
| Callback URL couldn't be validated | Host unreachable — `api.somreception.botandev.com` has no DNS unless configured |
| Messages not in UI | WhatsApp account connected in Settings for your business |
