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

*Filled in by Stage 3 commit.*

## Stage 4: Storage cutover

*Filled in by Stage 4 commit.*

## Stage 5: Realtime replacement

*Filled in by Stage 5 commit.*
