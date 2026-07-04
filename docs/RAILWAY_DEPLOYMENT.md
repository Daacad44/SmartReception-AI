# Deploying the Backend to Railway

This is the runbook for moving the Express API + BullMQ worker off Vercel serverless
and onto Railway, while the frontend stays on Vercel. Background: Vercel serverless
functions are stateless and cannot hold a persistent connection, which two parts of
this backend need — the BullMQ worker (`src/worker.ts`, see `docs/WORKER_DEPLOYMENT.md`)
and the realtime WebSocket gateway (`src/infrastructure/realtime/ws-gateway.service.ts`,
see `docs/MIGRATING_OFF_SUPABASE.md` §Stage 5). Railway runs both as long-lived processes.

**This supersedes the "Production (recommended: Upstash Redis)" section of
`docs/WORKER_DEPLOYMENT.md`** — Redis is now provisioned via Railway's own plugin
instead of Upstash (see below). Everything else in that doc (what the worker does,
Vercel's limitations) still applies.

No auth changes are needed for this move — auth is custom JWT (`jsonwebtoken`) +
bcrypt + TOTP, entirely self-contained in this codebase, not tied to any hosting
platform.

## Prerequisites (code-side, already done)

- `backend/Dockerfile` builds `packages/shared` before the backend (fixed —
  previously this was missing and a fresh build would have failed since
  `packages/shared/dist` is gitignored).
- `backend/package.json` has `start:railway` (`prisma migrate deploy && node
  dist/server.js`) and `db:migrate:deploy` (`prisma migrate deploy`) scripts.
- `railway.json` at the repo root points Railway at the Dockerfile and sets the
  default start command + health check.

Verify locally before deploying (needs a Docker daemon):
```bash
docker build -f backend/Dockerfile -t smartreception-backend .
```

## 1. Create the Railway project

Deploy **directly from this monorepo** — no code extraction needed. Railway supports
building a subdirectory Dockerfile with the full repo as build context:

1. New Railway project → "Deploy from GitHub repo" → select this repo.
2. Railway will detect `railway.json` at the root and use `backend/Dockerfile`
   automatically (Root Directory stays `/`, i.e. the repo root — do **not** set it to
   `backend`, since the Dockerfile's `COPY` steps need the monorepo root as
   build context to reach `packages/shared`).
3. Rename this first service `api`.

## 2. Add a second service for the worker

Same repo, same Dockerfile, different start command — mirrors the existing
`docker-compose.yml` pattern where `backend` and `worker` are the same image with
different `command`s.

1. In the same Railway project, "New Service" → same GitHub repo again.
2. Rename it `worker`.
3. In this service's **Settings → Deploy → Custom Start Command**, override to:
   ```
   node dist/worker.js
   ```
   (Leave Build settings alone — it inherits `railway.json`'s Dockerfile config.
   Only the start command differs; `railway.json` itself can't express two start
   commands for one Dockerfile, so this one override happens in the dashboard.)

## 3. Add Redis

Railway project → "New" → "Database" → "Redis". This provisions a Redis instance in
the same project/region and gives you a `REDIS_URL` reference variable.

In **both** `api` and `worker` services' Variables tab, add:
```
REDIS_URL = ${{Redis.REDIS_URL}}
```
(Railway's reference-variable syntax — it resolves to the plugin's connection string
automatically, no copy-pasting a URL by hand, and it updates automatically if the
plugin ever rotates credentials.)

## 4. Environment variables

Railway auto-injects `PORT` (the app already reads `process.env.PORT` via
`config/index.ts`) and `REDIS_URL` (step 3). Set the rest manually per service.

### Both `api` and `worker`
```
DATABASE_URL=<same Supabase/Postgres URL currently used on Vercel>
DIRECT_URL=<same as above>
NODE_ENV=production
JWT_SECRET=<same value as Vercel — do not rotate, existing tokens must still verify>
JWT_REFRESH_SECRET=<same value as Vercel>
AI_PROVIDER=gemini
GEMINI_API_KEY=<same as Vercel>
R2_ACCOUNT_ID=<same as Vercel>
R2_ACCESS_KEY_ID=<same as Vercel>
R2_SECRET_ACCESS_KEY=<same as Vercel>
R2_KNOWLEDGE_BUCKET=knowledge-documents
R2_WHATSAPP_MEDIA_BUCKET=whatsapp-media
SUPABASE_URL=<same as Vercel — still used as storage read-fallback, see MIGRATING_OFF_SUPABASE.md Stage 4>
SUPABASE_SERVICE_ROLE_KEY=<same as Vercel>
```

### `api` only (not needed by the worker)
```
FRONTEND_URL=<Vercel production domain, e.g. https://somreception.botandev.com>
WHATSAPP_VERIFY_TOKEN=<same as Vercel — Meta's webhook re-verification must match>
WHATSAPP_ACCESS_TOKEN=<same as Vercel>
WHATSAPP_PHONE_NUMBER_ID=<same as Vercel>
WHATSAPP_BUSINESS_ACCOUNT_ID=<same as Vercel>
META_APP_ID=<same as Vercel>
WHATSAPP_APP_SECRET=<same as Vercel>
META_WHATSAPP_CONFIG_ID=<same as Vercel — Embedded Signup>
RESEND_API_KEY=<same as Vercel>
```

### Optional (only if used)
```
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS   # legacy email fallback
```

Do **not** copy any `VITE_*` variables to Railway — those are frontend build-time
only and irrelevant to the backend.

## 5. Scaling note — keep `api` at 1 replica for now

The realtime WebSocket gateway (`ws-gateway.service.ts`) tracks connected clients
in-process memory, per replica. If you scale `api` beyond 1 replica, a client
connected to replica A will never receive a broadcast published from replica B —
this fails silently (no error, just missed live updates). Keep `api` pinned to 1
replica until a Redis pub/sub fan-out layer is added (flagged as a follow-up in
`docs/MIGRATING_OFF_SUPABASE.md` §Stage 5; not built yet). The `worker` service has
no such constraint — BullMQ is already designed for multiple worker replicas.

## 6. Deploy and verify

1. Deploy `api`. Once live, check `GET https://<railway-domain>/health` — expect
   `200 {"status":"ok","database":"connected",...}`.
2. Check Railway logs for `api` — should show `Server running on port ... ` and
   `Realtime WebSocket gateway attached at /api/v1/realtime`.
3. Deploy `worker`. Check its logs for BullMQ queue initialization (no HTTP server
   log lines expected — it doesn't call `app.listen()`).
4. Do a quick authenticated smoke test directly against the Railway URL (e.g. log in
   via the API) before touching anything user-facing.

## 7. Cut over WhatsApp (hard cutover)

This step is picked as a **hard cutover** (immediate switch, no dual-run window) —
higher risk than a gradual rollout, so do steps 1–3 above first and don't skip them.

1. Meta Developer Console → your App → WhatsApp → Configuration.
2. Change the Callback URL to `https://<railway-domain>/api/v1/webhooks/whatsapp`.
3. Verify Token field must exactly match the `WHATSAPP_VERIFY_TOKEN` env var set on
   Railway's `api` service (same value as before — Meta re-verifies on save).
4. Meta immediately sends a `GET` verification request — confirm it succeeds (check
   Railway `api` logs for the "WhatsApp webhook verification successful" line, or
   Meta's console will show a green checkmark).
5. Watch incoming WhatsApp traffic closely for the first hour. There is no automatic
   fallback with a hard cutover — if something's wrong, follow the rollback below
   immediately rather than debugging live in production.

## 8. Point the frontend at Railway

In Vercel project settings (frontend), set:
```
VITE_API_URL=https://<railway-domain>/api/v1
```
Redeploy the frontend. This single variable also fixes realtime — the WebSocket
client (`frontend/src/lib/realtime-client.ts`) derives its URL from
`VITE_API_URL`, swapping `http(s)` for `ws(s)` and appending `/realtime`.

Also set `FRONTEND_URL` on Railway's `api` service to the Vercel production domain.
No other CORS change is needed — `backend/src/app.ts`'s CORS handler already
allows any `*.vercel.app` origin (covers preview deployments) plus `config.frontendUrl`.

## 9. Rollback plan

Because step 7 is a hard cutover, keep the rollback path alive until Railway has
proven stable for a few days:
- **Do not delete** `api/index.js` / `api/webhook.js` or simplify `vercel.json` yet
  (step 10 does that, later).
- If something breaks: revert Meta's Callback URL back to the old Vercel webhook
  URL, and revert `VITE_API_URL` on Vercel to the old relative `/api/v1`. Both
  revert independently and instantly (no redeploy of Railway needed to roll back).

## 10. Clean up Vercel (only after Railway is confirmed stable)

Once Railway has run cleanly for a few days:
1. Edit root `vercel.json` — remove the `functions` block (`api/index.js`,
   `api/webhook.js`) and the `/api/*`, `/webhook*`, `/health` rewrites. The Vercel
   project becomes a pure static SPA host.
2. Delete `api/index.js` and `api/webhook.js` (no longer reachable once the
   rewrites are gone).
3. Remove `SUPABASE_*` env vars from Vercel (the frontend never needed them after
   the Stage 5 realtime migration; only the Railway backend still uses them, for
   the storage read-fallback documented in `docs/MIGRATING_OFF_SUPABASE.md` Stage 4).
