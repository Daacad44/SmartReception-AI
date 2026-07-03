# Worker & Redis Deployment

SmartReception AI uses BullMQ for background jobs: AI replies, WhatsApp outbound, document indexing, and appointment reminders.

## Local development

```bash
docker-compose up -d redis
npm run worker -w @smartreception/backend
```

## Production

**See `docs/RAILWAY_DEPLOYMENT.md` for the full runbook** (this is the current
recommended setup: both the API and this worker run as two Railway services from
the same repo/Dockerfile, sharing a Railway-provisioned Redis plugin instance).

The short version:
1. Railway Redis plugin (not Upstash — see `docs/RAILWAY_DEPLOYMENT.md` §3) provides
   `REDIS_URL` as a reference variable to both services.
2. `worker` service: same repo/Dockerfile as the API, Custom Start Command overridden
   to `node dist/worker.js`.
3. Set the same env vars as the API (`DATABASE_URL`, `GEMINI_API_KEY`, `WHATSAPP_*`,
   `R2_*`, etc.) — see `docs/RAILWAY_DEPLOYMENT.md` §4 for the exact per-service list.

If deploying the worker anywhere other than Railway (Render/Fly/etc.), Upstash Redis
(`rediss://` TLS URL) remains a reasonable alternative — the app only needs a valid
`REDIS_URL`, it isn't tied to a specific Redis provider.

## Vercel limitations

Vercel serverless functions cannot run persistent BullMQ workers. Without a separate worker + Redis:

- Document processing uses fire-and-forget inline fallback
- AI replies and WhatsApp sends may not run reliably
- Appointment reminders are skipped

**Mitigation:** Deploy the worker to Railway/Render/Fly with `REDIS_URL` pointing to Upstash.

## Rate limiting

When `REDIS_URL` is set, API rate limits use Redis (distributed across serverless instances).
