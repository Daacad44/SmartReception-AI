# Worker & Redis Deployment

SmartReception AI uses BullMQ for background jobs: AI replies, WhatsApp outbound, document indexing, and appointment reminders.

## Local development

```bash
docker-compose up -d redis
npm run worker -w @smartreception/backend
```

## Production (recommended: Upstash Redis)

1. Create an [Upstash Redis](https://upstash.com/) database
2. Set `REDIS_URL` in Vercel / your host (use the `rediss://` TLS URL)
3. Deploy the worker as a separate long-running service

### Railway / Render / Fly.io worker

```bash
# Build
npm run build -w @smartreception/shared
npm run build -w @smartreception/backend

# Start worker
npm run worker -w @smartreception/backend
```

Set the same env vars as the API (`DATABASE_URL`, `OPENAI_API_KEY`, `WHATSAPP_*`, etc.).

## Vercel limitations

Vercel serverless functions cannot run persistent BullMQ workers. Without a separate worker + Redis:

- Document processing uses fire-and-forget inline fallback
- AI replies and WhatsApp sends may not run reliably
- Appointment reminders are skipped

**Mitigation:** Deploy the worker to Railway/Render/Fly with `REDIS_URL` pointing to Upstash.

## Rate limiting

When `REDIS_URL` is set, API rate limits use Redis (distributed across serverless instances).
