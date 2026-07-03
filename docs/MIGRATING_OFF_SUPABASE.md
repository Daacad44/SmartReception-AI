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

For a **fresh self-hosted Postgres**, delete those two folders from `apps/backend/prisma/migrations/` before running `prisma migrate deploy` for the first time. They cover Supabase-only infrastructure that has no plain-Postgres equivalent; the storage-side replacement lives in Stage 4 and the realtime replacement lives in Stage 5.

The `20240620000000_pgvector` migration (`CREATE EXTENSION IF NOT EXISTS vector`) is safe to keep on any Postgres that has the `pgvector` package installed, and safe to delete otherwise — the app currently stores embeddings as JSON and does cosine similarity in-process, so the extension is unused today (see plan risk R6).

### Env vars
`DATABASE_URL` and `DIRECT_URL` are the only Postgres knobs the app reads (`apps/backend/src/config/index.ts`). Point both at the new host. If the target host has its own connection pooler (PgBouncer/pgcat), `DATABASE_URL` should use it and `DIRECT_URL` should bypass it — same pattern as Supabase's 6543 vs 5432 split.

### Verification
```bash
cd apps/backend
npx prisma migrate deploy   # applies all migrations including the new selfhost_compat
npx prisma db seed          # optional
npm test                    # 51 unit tests should still pass
```

## Stage 2: Auth

**No code changes required.** Verified against the current codebase.

The audit (`backup-plan/answer.md` §4) confirmed the app has never used Supabase Auth:

- Identity lives in the app's own `users` table (`passwordHash`, `totpSecret`, `totpBackupCodes`, `emailVerifiedAt`, etc.), not `auth.users`.
- Access tokens are minted by `apps/backend/src/infrastructure/auth/token.service.ts` using `jsonwebtoken` against `config.jwt.secret` — 15 min expiry, payload claims `{userId, email, businessId, role}`. Refresh tokens are separately signed against `config.jwt.refreshSecret`, 7-day expiry, persisted rotating in the `refresh_tokens` table.
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
cd apps/backend
npm test   # 51 unit tests include auth (token/password/totp/subscription-license) — all pass
```

## Stage 3: Routes

**No code changes required.** Verified against the current codebase.

The audit (`backup-plan/answer.md` §8) confirmed the entire frontend data + auth surface already goes through the Express API:

- **Zero** `.from(` / `.rpc(` / `.storage.` / `.auth.` calls anywhere in `apps/frontend/src` — grep-verified. Every `Array.from(` hit is JS, not Supabase.
- The axios `api` client (`apps/frontend/src/lib/api.ts`) attaches `Authorization: Bearer <accessToken>` (L71–73) and `X-Business-Id` (L75) on every request; a 401 interceptor calls `/auth/refresh` (L116+).
- Tokens are in the Zustand `auth.store`.
- Every data hook (`apps/frontend/src/hooks/useApi.ts`, `useMutations.ts`) hits Express routes under `/api/v1/…`.

Because the frontend never called Supabase for data, there are **no routes to port**. All the routes already exist.

The only Supabase-facing frontend code today is `apps/frontend/src/hooks/useRealtime.ts` + `lib/supabase.ts` + `lib/supabase-config.ts` — those get replaced in Stage 5 (realtime).

### Verification
```bash
cd apps/frontend
grep -rE "\.from\(|\.rpc\(|\.storage\.|\.auth\." src/ | grep -v "Array\.from\|// "
# Expected: only the .channel() hits in hooks/useRealtime.ts
```

## Stage 4: Storage cutover

**Cloudflare R2 becomes the primary object store for both buckets** (`knowledge-documents` and `whatsapp-media`). Supabase Storage stays wired only as a *read-fallback* for legacy `supabase://…` URLs during the backfill window, so nothing that's already stored in Supabase breaks.

### What changed
- `apps/backend/src/infrastructure/storage/r2.service.ts` — `R2StorageService` now takes `{ bucket, signedUrlTtl }` in its constructor and generates real signed private-bucket URLs on upload (rather than returning bare keys). A `createR2StorageService()` factory lets us stand up more than one bucket-scoped instance.
- `apps/backend/src/infrastructure/storage/supabase-storage.service.ts` — parametrized the same way (`{ bucket, signedUrlTtl, fileSizeLimit, allowedMimeTypes }`), plus a `createSupabaseStorageService()` factory. The `knowledge-documents` singleton is preserved for backward compatibility.
- `apps/backend/src/infrastructure/storage/index.ts` — `UnifiedStorageService` flipped to **R2-primary**. Reads/deletes route by URL scheme: any URL that looks like a Supabase Storage URL (`supabase://…` or `/storage/v1/object/…`) goes back to Supabase for as long as Supabase remains configured; everything else goes to R2. A second unified provider, `whatsappMediaStorage`, targets the `whatsapp-media` bucket with 7-day TTL.
- `apps/backend/src/infrastructure/whatsapp/whatsapp-media.service.ts` — dropped its private `@supabase/supabase-js` client entirely. `storeInboundMedia` now delegates to `whatsappMediaStorage`; `downloadFromMeta` is unchanged (that talks to Meta, not Supabase).
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
npx tsc --noEmit -p apps/backend/tsconfig.json  # zero errors
cd apps/backend && npm test                     # 51/51 pass
# Manual smoke: upload a knowledge doc, upload a WhatsApp media message,
# confirm the returned URL is an R2 signed URL, not a supabase.co URL.
```

## Stage 5: Realtime replacement

*Filled in by Stage 5 commit.*
