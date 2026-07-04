# Migrating off Supabase

Live migration guide for taking SmartReception AI off Supabase and onto a self-hosted (or third-party managed) Postgres + object store + WebSocket stack.

Read alongside `backup-plan/answer.md` (the audit) and `backup-plan/planToNode.md` (the migration plan). This doc is the operational companion — the plan tells you *what*, this tells you *how*.

## Order

The migration ships in five stages, each landing as its own commit so it can be reviewed and rolled back independently:

1. **Prisma schema portability** — this doc + a new no-op migration.
2. **Auth** — verified portable, no code changes.
3. **Routes** — verified portable, no code changes.
4. **Storage cutover** — flip R2 to primary, port `whatsapp-media` off Supabase-only.
5. **Realtime replacement** — Express WebSocket gateway; drop Supabase realtime.

## Stage 1: Prisma schema portability

### What already works out of the box
The schema itself is plain Postgres — 99 models, 74 enums, all `@@map`-ed, all UUID PKs generated in the app, zero Supabase-proprietary column types, zero views. Prisma connects the same way to any Postgres. Pointing `DATABASE_URL` / `DIRECT_URL` at the new host and running `prisma migrate deploy` is the entire host swap.

### What migration `20260703170000_selfhost_compat` fixes
The audit found a single deny-all RLS policy on `governance_approval_requests` (added as defense-in-depth against Supabase's PostgREST anon role). Prisma always connects as a privileged role, so the policy was already a no-op for the app; it becomes actively harmful on self-hosted setups that intend to run replication/PostgREST/foreign servers on this table later. The migration drops the policy and disables RLS on that table. Idempotent — safe on both hosts.

### Bootstrap gotcha for a *fresh* self-hosted Postgres
Two of the older migrations reference Supabase-only objects and will fail against a fresh plain Postgres if applied verbatim:

- `20240616000001_storage_policies/` — `CREATE POLICY … ON storage.objects` (Supabase Storage schema).
- `20240620000001_realtime_publication/` — `ALTER PUBLICATION supabase_realtime …` (Supabase Realtime publication).

On the existing Supabase-hosted database these are already applied and recorded in `_prisma_migrations`, so nothing changes there.

For a **fresh self-hosted Postgres**, delete those two folders from `backend/prisma/migrations/` before running `prisma migrate deploy` for the first time. They cover Supabase-only infrastructure that has no plain-Postgres equivalent; the storage-side replacement lives in Stage 4 and the realtime replacement lives in Stage 5.

The `20240620000000_pgvector` migration (`CREATE EXTENSION IF NOT EXISTS vector`) is safe to keep on any Postgres that has the `pgvector` package installed, and safe to delete otherwise — the app currently stores embeddings as JSON and does cosine similarity in-process, so the extension is unused today (see plan risk R6).

### Env vars
`DATABASE_URL` and `DIRECT_URL` are the only Postgres knobs the app reads (`backend/src/config/index.ts`). Point both at the new host. If the target host has its own connection pooler (PgBouncer/pgcat), `DATABASE_URL` should use it and `DIRECT_URL` should bypass it — same pattern as Supabase's 6543 vs 5432 split.

### Verification
```bash
cd backend
npx prisma migrate deploy   # applies all migrations including the new selfhost_compat
npx prisma db seed          # optional
npm test                    # 51 unit tests should still pass
```

## Stage 2: Auth

**No code changes required.** Verified against the current codebase.

The audit (`backup-plan/answer.md` §4) confirmed the app has never used Supabase Auth:

- Identity lives in the app's own `users` table (`passwordHash`, `totpSecret`, `totpBackupCodes`, `emailVerifiedAt`, etc.), not `auth.users`.
- Access tokens are minted by `backend/src/infrastructure/auth/token.service.ts` using `jsonwebtoken` against `config.jwt.secret` — 15 min expiry, payload claims `{userId, email, businessId, role}`. Refresh tokens are separately signed against `config.jwt.refreshSecret`, 7-day expiry, persisted rotating in the `refresh_tokens` table.
- Passwords hash via `bcryptjs` in `password.service.ts`.
- 2FA is TOTP via `speakeasy` in `totp.service.ts`; backup codes are bcrypt-hashed.
- Email OTP verification is via Resend in `otp.service.ts`.
- Login lockout is tracked in the app in `login-lockout.service.ts`.
- Zero calls to `.auth.` on any Supabase client anywhere (`grep`-verified in the audit).

None of this depends on Supabase infrastructure. It works unchanged against any Postgres.

### Env vars carried over
`JWT_SECRET`, `JWT_REFRESH_SECRET`, `RESEND_API_KEY` (email OTP), plus the same `DATABASE_URL` / `DIRECT_URL` from Stage 1. No new env vars.

### Verification
```bash
cd backend
npm test   # 51 unit tests include auth (token/password/totp/subscription-license) — all pass
```

## Stage 3: Routes

**No code changes required.** Verified against the current codebase.

The audit (`backup-plan/answer.md` §8) confirmed the entire frontend data + auth surface already goes through the Express API:

- **Zero** `.from(` / `.rpc(` / `.storage.` / `.auth.` calls anywhere in `frontend/src` — grep-verified. Every `Array.from(` hit is JS, not Supabase.
- The axios `api` client (`frontend/src/lib/api.ts`) attaches `Authorization: Bearer <accessToken>` (L71–73) and `X-Business-Id` (L75) on every request; a 401 interceptor calls `/auth/refresh` (L116+).
- Tokens are in the Zustand `auth.store`.
- Every data hook (`frontend/src/hooks/useApi.ts`, `useMutations.ts`) hits Express routes under `/api/v1/…`.

Because the frontend never called Supabase for data, there are **no routes to port**. All the routes already exist.

The only Supabase-facing frontend code today is `frontend/src/hooks/useRealtime.ts` + `lib/supabase.ts` + `lib/supabase-config.ts` — those get replaced in Stage 5 (realtime).

### Verification
```bash
cd frontend
grep -rE "\.from\(|\.rpc\(|\.storage\.|\.auth\." src/ | grep -v "Array\.from\|// "
# Expected: only the .channel() hits in hooks/useRealtime.ts
```

## Stage 4: Storage cutover

**Cloudflare R2 becomes the primary object store for both buckets** (`knowledge-documents` and `whatsapp-media`). Supabase Storage stays wired only as a *read-fallback* for legacy `supabase://…` URLs during the backfill window, so nothing that's already stored in Supabase breaks.

### What changed
- `backend/src/infrastructure/storage/r2.service.ts` — `R2StorageService` now takes `{ bucket, signedUrlTtl }` in its constructor and generates real signed private-bucket URLs on upload (rather than returning bare keys). A `createR2StorageService()` factory lets us stand up more than one bucket-scoped instance.
- `backend/src/infrastructure/storage/supabase-storage.service.ts` — parametrized the same way (`{ bucket, signedUrlTtl, fileSizeLimit, allowedMimeTypes }`), plus a `createSupabaseStorageService()` factory. The `knowledge-documents` singleton is preserved for backward compatibility.
- `backend/src/infrastructure/storage/index.ts` — `UnifiedStorageService` flipped to **R2-primary**. Reads/deletes route by URL scheme: any URL that looks like a Supabase Storage URL (`supabase://…` or `/storage/v1/object/…`) goes back to Supabase for as long as Supabase remains configured; everything else goes to R2. A second unified provider, `whatsappMediaStorage`, targets the `whatsapp-media` bucket with 7-day TTL.
- `backend/src/infrastructure/whatsapp/whatsapp-media.service.ts` — dropped its private `@supabase/supabase-js` client entirely. `storeInboundMedia` now delegates to `whatsappMediaStorage`; `downloadFromMeta` is unchanged (that talks to Meta, not Supabase).
- `.env.example` — added `R2_KNOWLEDGE_BUCKET` / `R2_WHATSAPP_MEDIA_BUCKET`; kept `R2_BUCKET_NAME` for backward compatibility (used if `R2_KNOWLEDGE_BUCKET` is unset).

Nothing else touched. All four call sites of `storageService` (`knowledge`, `business-profile`, `governance`, `governance-executor`) continue to work through the same `IStorageService` interface; `incoming-message.service.ts` continues to call `whatsappMediaService` with the same signature. Type-check clean, all 51 backend tests still pass.

### R2 setup checklist (before deploying this stage)
1. Create the R2 account and generate an access key pair (Cloudflare Dashboard → R2 → Manage R2 API Tokens → "Object Read & Write").
2. Create two private buckets: `knowledge-documents` and `whatsapp-media`.
3. Set env vars in the target environment: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_KNOWLEDGE_BUCKET=knowledge-documents`, `R2_WHATSAPP_MEDIA_BUCKET=whatsapp-media`.
4. Leave `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` set for now — they're the read-fallback for existing objects.

### Backfill (existing objects)
The plan (`planToNode.md` §4 step 2) calls for a bulk copy of existing objects from Supabase Storage → R2 before dropping Supabase Storage. This is an out-of-band operation, not a code change:

```
# Sketch — replace URLs/keys with the live values.
supabase storage download --recursive --local-out ./tmp knowledge-documents
supabase storage download --recursive --local-out ./tmp whatsapp-media
aws --endpoint-url https://<account>.r2.cloudflarestorage.com s3 sync ./tmp/knowledge-documents s3://knowledge-documents
aws --endpoint-url https://<account>.r2.cloudflarestorage.com s3 sync ./tmp/whatsapp-media s3://whatsapp-media
```

After the sync, existing `KnowledgeDocument.fileUrl` values that were Supabase signed URLs need to be rewritten to R2 signed URLs (a one-off script that re-uploads or re-signs; not shipped with this migration since object counts are out of scope for the audit). Until that script runs, the read-fallback keeps legacy URLs resolving.

### Env cleanup (after backfill)
Once the backfill is verified and no more `supabase://…` or `/storage/v1/object/…` URLs remain in the DB (`KnowledgeDocument.fileUrl`, `Message.mediaUrl`, `BusinessProfile.profilePdfUrl`, `GovernanceApprovalRequest.stagingStorageKey`), drop the Supabase env vars — the storage layer will only touch R2.

### Verification
```bash
npx tsc --noEmit -p backend/tsconfig.json  # zero errors
cd backend && npm test                     # 51/51 pass
# Manual smoke: upload a knowledge doc, upload a WhatsApp media message,
# confirm the returned URL is an R2 signed URL, not a supabase.co URL.
```

## Stage 5: Realtime replacement

**Supabase Realtime is fully replaced** with an Express WebSocket gateway. This
was the only genuinely stateful piece of the migration (plan risks R1 + R2) —
everything else was either already portable or a straightforward provider swap.

### What changed
- **New: `backend/src/infrastructure/realtime/ws-gateway.service.ts`** — a
  `WebSocketServer` attached to the same HTTP server as the Express app
  (`noServer: true` + manual `upgrade` handling on path `/api/v1/realtime`).
  JWT auth via `?token=` query string (browsers can't set custom headers on
  the WS handshake). Tracks clients by `businessId` (business-wide fan-out)
  and by `conversationId` (opt-in `subscribe`/`unsubscribe` messages from the
  client), with a 30s ping/pong liveness sweep. Emits `conversation_update`
  and `business_update` events — the exact same event names/payload shapes
  `useRealtime.ts` already consumed from Supabase, so no invalidation logic
  needed to change, only the transport.
- **`backend/src/infrastructure/realtime/broadcast.service.ts`** — the
  three exported functions (`broadcastConversationEvent`, `broadcastBusinessEvent`,
  `broadcastAiAnalyticsUpdate`) keep their exact signatures, so none of the
  ~14 calling services needed changes. Internally they now **dual-emit**:
  primary path is `wsGateway.emit*()` (synchronous, in-process, no network
  hop); secondary path still sends to Supabase realtime *if* `SUPABASE_URL`/
  `SUPABASE_SERVICE_ROLE_KEY` are set, so any client still running the old
  Supabase-based code keeps working during rollout. When those env vars are
  unset, the Supabase path silently no-ops.
- **`backend/src/server.ts`** — `wsGateway.attach(server)` after
  `app.listen(...)`, and `wsGateway.detach()` in the graceful-shutdown path.
- **New: `frontend/src/lib/realtime-client.ts`** — a small `RealtimeClient`
  wrapping the browser `WebSocket`: connects with the JWT access token,
  exponential-backoff reconnect (capped 10s), re-subscribes to any
  conversation rooms after a reconnect, and dispatches typed events to
  registered listeners. `resolveRealtimeUrl()` derives the WS URL from
  `VITE_API_URL` (swaps `http(s)` → `ws(s)`, appends `/realtime`) so no new
  frontend env var is needed.
- **`frontend/src/hooks/useRealtime.ts`** — rewritten against
  `RealtimeClient` instead of `getSupabase()`. A single shared client/socket
  is reused across every component via a ref-count (`retainConnection`), so
  a business-wide subscriber and several open-conversation subscribers all
  multiplex one WebSocket per tab rather than opening one Supabase channel
  each. `useBusinessRealtime` and `useConversationRealtime` keep their exact
  exported signatures and invalidate the same React Query keys as before.
- **Cleanup (frontend now fully off Supabase):** deleted
  `frontend/src/lib/supabase.ts` and `supabase-config.ts` (dead code
  once `useRealtime.ts` stopped calling `getSupabase()` — confirmed via
  repo-wide grep, zero remaining references). Removed the now-unused
  `@supabase/supabase-js` dependency from `frontend/package.json` (the
  `vendor-supabase` chunk is gone from the production build). Removed
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from `.env.example` — the
  frontend needs zero Supabase configuration now. Fixed one incidental
  breakage: `frontend/src/hooks/useApi.ts` used
  `isSupabaseConfigured` to decide whether to poll conversations as a
  fallback when realtime wasn't configured; since the WS gateway is always
  attempted now (matching the `false`/no-polling behavior production already
  had when Supabase was configured), that constant is now unconditionally
  `false` with a comment explaining why.

### What did NOT change
- Backend still depends on `@supabase/supabase-js` — it's used by the Stage 4
  storage read-fallback and by `broadcast.service.ts`'s transitional
  dual-emit. Both are intentionally temporary; see cleanup below.
- Event shapes, query-invalidation keys, and the public API of
  `useBusinessRealtime`/`useConversationRealtime` are unchanged — this was a
  transport swap, not a behavior change.

### Known limitation (flagged, not fixed in this stage)
`WsGateway` is **single-instance, in-memory only** — client registries
(`byBusiness`, `byConversation`) live in one Node process's memory. Running
more than one API replica means a client connected to replica A never
receives an event broadcast from replica B. This matches the plan's scope
(`planToNode.md` open question §5.3 — pooling/host decisions were flagged as
open, not resolved) and is fine for a single long-lived Node instance, but
**multi-replica deployments need a fan-out layer** (Redis pub/sub is the
natural choice, since Redis is already a hard dependency for BullMQ) before
scaling the API horizontally. Not built here — flagging per the audit's own
instruction not to silently drop gaps.

### Deployment note
The WS gateway only runs where `backend/src/server.ts` runs as a
long-lived process (e.g. Railway/Render/Fly — the same host as the BullMQ
worker). It is **not** attached in the Vercel serverless entrypoints
(`api/index.js`, `api/webhook.js`), which only call `createApp()` and have no
persistent process to hold sockets. Fully leaving Vercel serverless for the
main API (not just the worker) is a prerequisite for realtime to work
end-to-end post-migration — this was already implied by `planToNode.md`
§4 step 3 ("Vercel serverless can't hold sockets... may also force a
long-lived Node host decision") but is called out explicitly here since it's
a hard requirement, not an optimization.

### Final cleanup (do after this stage is verified live)
Once no client is depending on the Supabase realtime fallback:
1. Remove the `sendViaSupabase` dual-emit branch from `broadcast.service.ts`.
2. Complete Stage 4's storage cleanup (drop Supabase storage fallback once
   backfilled) — the two remaining backend `@supabase/supabase-js` call
   sites (storage fallback + broadcast dual-emit) both go away together.
3. Remove `@supabase/supabase-js` from `backend/package.json` and
   `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY` from env —
   at that point the app has zero Supabase dependencies anywhere.
4. Drop the two Supabase-only Prisma migrations
   (`20240616000001_storage_policies`, `20240620000001_realtime_publication`)
   from the *self-hosted* migration history per the Stage 1 bootstrap note
   (leave them in place for the existing Supabase-hosted database's history).

### Verification
```bash
npx tsc --noEmit -p backend/tsconfig.json   # zero errors
cd frontend && npx tsc --noEmit             # zero errors
cd backend && npm test                      # 51/51 pass
cd frontend && npm run build                # vendor-supabase chunk gone

# Manual smoke (needs a running backend + frontend):
# 1. Open the dashboard in two tabs, log in as the same business in both.
# 2. Trigger a change that used to broadcast (e.g. send/receive a WhatsApp
#    message, update an appointment) and confirm both tabs update without
#    a manual refresh.
# 3. Check the Network tab: one WS connection to /api/v1/realtime per tab,
#    no more requests to *.supabase.co.
```

