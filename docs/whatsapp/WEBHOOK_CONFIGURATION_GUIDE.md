# Webhook Configuration Guide

## Production Endpoints

| Method | URL | Purpose |
|--------|-----|---------|
| `GET` | `https://api.somreception.botandev.com/api/v1/webhooks/whatsapp` | Meta subscription verification |
| `POST` | `https://api.somreception.botandev.com/api/v1/webhooks/whatsapp` | Incoming messages and status events |

Legacy path (backward compatible): `/api/v1/whatsapp/webhook`

## Meta Developer Console Setup

1. Open [Meta for Developers](https://developers.facebook.com/) → your app → **WhatsApp** → **Configuration**.
2. Under **Webhook**, click **Edit**.
3. Set **Callback URL** to:
   ```
   https://api.somreception.botandev.com/api/v1/webhooks/whatsapp
   ```
4. Set **Verify token** to the same value as your server `VERIFY_TOKEN` (or `WHATSAPP_VERIFY_TOKEN`) environment variable.
5. Click **Verify and save**.
6. Subscribe to webhook fields:
   - `messages`
   - `message_template_status_update` (optional, for template analytics)
7. Under **WhatsApp Business Account**, ensure your phone number is connected.

## Verification Flow (GET)

Meta sends:

```
GET /api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=RANDOM_STRING
```

SmartReception validates:

- `hub.mode` === `subscribe`
- `hub.verify_token` === `VERIFY_TOKEN` from environment

On success: returns `hub.challenge` as plain text with HTTP 200.  
On failure: returns HTTP 403.

## Incoming Events (POST)

Meta sends JSON payloads for:

- New messages (text, media, interactive, contacts, location)
- Status updates (sent, delivered, read, failed)

SmartReception:

1. Verifies `X-Hub-Signature-256` using `META_APP_SECRET` or `WHATSAPP_APP_SECRET`
2. Returns `EVENT_RECEIVED` immediately (HTTP 200)
3. Processes payload asynchronously

## Required Server Environment

```env
VERIFY_TOKEN=your-chosen-verify-token
META_APP_SECRET=your-meta-app-secret
WHATSAPP_APP_SECRET=your-meta-app-secret
API_URL=https://api.somreception.botandev.com
```

`API_URL` is used to display the webhook URL in the Settings UI.

## SmartReception Settings UI

Navigate to **Settings → WhatsApp** to:

- Copy the production webhook URL
- Copy the verify token (when configured on server)
- View webhook status (`pending`, `receiving`, `verified`)
- Test API connectivity

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Verification fails (403) | `VERIFY_TOKEN` on server matches Meta console exactly |
| Webhook receives nothing | Phone number subscribed to app; fields `messages` enabled |
| 403 on POST | `META_APP_SECRET` matches app secret in Meta dashboard |
| Messages not in UI | WhatsApp account connected in Settings for your business |
| Duplicate messages | Should not occur — `whatsapp_webhook_events` deduplicates by `eventId` |

## Firewall / Infrastructure

Ensure `api.somreception.botandev.com` is publicly reachable by Meta's webhook IPs. No IP allowlist is configured in the application; signature verification provides authentication.
