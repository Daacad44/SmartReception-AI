# Testing Report — WhatsApp Integration

## Automated Tests

Location: `apps/backend/src/infrastructure/whatsapp/whatsapp.test.ts`

Run:

```bash
npm run test -w @smartreception/backend
```

### Test Cases (5 passing)

| Test | Description |
|------|-------------|
| Parses inbound text messages | Validates webhook parser extracts phone_number_id and message body |
| Parses delivery status updates | Validates status webhook parsing (delivered, etc.) |
| Extracts interactive button reply | Button reply title mapped to message content |
| Extracts image media metadata | Media ID, caption, and type extraction |
| Validates X-Hub-Signature-256 | HMAC-SHA256 timing-safe comparison logic |

## Build Verification

```bash
npm run build
```

Both `@smartreception/backend` and `@smartreception/frontend` compile successfully.

## Manual Test Checklist

### Webhook Tests

- [ ] `GET /api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=test` returns `test`
- [ ] Invalid verify token returns 403
- [ ] POST with invalid signature returns 403 (when `META_APP_SECRET` is set)
- [ ] POST with valid signature returns `EVENT_RECEIVED`

### Connection Tests

- [ ] Settings → WhatsApp shows connection status
- [ ] **Connect from Environment** creates account when env vars are set
- [ ] **Test Connection** returns phone number info from Graph API
- [ ] **Disconnect** deactivates account

### Message Tests

- [ ] Send text from WhatsApp → appears in Conversations
- [ ] Agent reply from UI → delivered to WhatsApp
- [ ] AI auto-reply triggers when enabled
- [ ] Delivery status updates (check marks in UI)

### Media Tests

- [ ] Send image via WhatsApp → stored in Supabase, visible in conversation
- [ ] Send document → downloadable link in conversation
- [ ] Send audio/video → media player in conversation

### Template Tests

- [ ] Outbound template via API/worker with valid template name
- [ ] Template status webhook (if subscribed)

### Status Tests

- [ ] Message marked read on inbound (Graph API read receipt)
- [ ] Typing indicator before AI response
- [ ] Status progression: PENDING → SENT → DELIVERED → READ

### Analytics Tests

- [ ] `GET /api/v1/analytics/whatsapp` returns messages sent/received, response time, AI rate

## Test Environment Requirements

Manual tests require real credentials:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `VERIFY_TOKEN`
- `META_APP_SECRET`
- Redis (for queued outbound)
- Supabase (for media)

## Known Limitations

- Automated tests do not call the live Meta Graph API (no credentials in CI)
- End-to-end webhook tests require a public URL (use production or ngrok)
- Without Redis, outbound messages are saved but not sent via WhatsApp API

## CI Recommendation

Add to CI pipeline:

```yaml
- run: npm run test -w @smartreception/backend
- run: npm run build
```

For E2E, use Meta's test phone numbers in a staging environment with dedicated env vars.
