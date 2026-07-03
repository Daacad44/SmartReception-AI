# Migration Plan: Supabase → Node/Express (self-hosted stack)

> Based entirely on `backup-plan/answer.md`. **No code is written yet.** This is the plan
> to review before implementation. The big realization from the audit: this is *already*
> an Express + Prisma app; Supabase is only Postgres-host + Storage + Realtime. So the
> migration is small and well-bounded, not a rewrite.

---

## 1. Inventory summary

| Area | What exists today | Supabase-proprietary? | Migration effort |
|---|---|---|---|
| Schema | 99 Prisma models, 74 enums, all `@@map` snake_case, UUID PKs | No — plain Postgres | **None** (host swap only) |
| Views / generated cols | None | — | None |
| RLS | 1 deny-all policy on `governance_approval_requests`; storage.objects policies | Storage RLS is Supabase-specific | **Trivial** (drop / replace w/ existing middleware) |
| DB functions/triggers | None | — | None |
| Scheduled jobs | None in DB; BullMQ+Redis in app | No | None (already portable) |
| Auth | Custom JWT (15m) + refresh (7d) + bcrypt + TOTP + email OTP | No (not Supabase Auth) | **None** (already portable) |
| Storage | `knowledge-documents` (Supabase→R2 fallback), `whatsapp-media` (Supabase-only) | Yes | **Medium** |
| Realtime | `postgres_changes` on 5 tables + backend `broadcast` events | Yes | **High** (only real work) |
| Frontend data surface | 100% via Express `api` axios client; JWT Bearer + X-Business-Id | No | **None** (routes already exist) |
| Edge Functions | None | — | None |
| Env / keys | Backend: service-role (server-only); Frontend: anon (realtime only) | — | Remove after realtime cutover |

---

## 2. Risk list — items with no 1:1 Express equivalent

| # | Supabase feature (where) | Replacement | Notes |
|---|---|---|---|
| R1 | `postgres_changes` CDC on 5 tables (`useRealtime.ts`; publication migration `20240620000001`) | **Express WebSocket (or SSE) gateway** that emits the same per-table change signals | Highest-effort item. Emit from the same Prisma write paths that already call `broadcast.service.ts`. Preserve exact React Query invalidation keys (documented in answer.md §7). |
| R2 | Supabase `broadcast` events `conversation_update` / `business_update` (`realtime/broadcast.service.ts`, ~14 callers) | Same WS/SSE gateway + an internal event bus; replace service-role `channel.send` with `emitToBusiness(businessId, event, payload)` | Keep the `broadcast.service.ts` function signatures (`broadcastConversationEvent`, `broadcastBusinessEvent`, `broadcastAiAnalyticsUpdate`) so the 14 call sites are untouched — only the transport inside changes. |
| R3 | `knowledge-documents` bucket + `storage.objects` RLS (`supabase-storage.service.ts`, `storage/index.ts`) | Make existing **R2 (`r2.service.ts`) the primary**; keep `IStorageService` interface unchanged | `UnifiedStorageService` already abstracts this — flip provider priority, no caller changes. App already scopes paths by `businessId`, so DB RLS was never doing tenant isolation. |
| R4 | `whatsapp-media` bucket, Supabase-only (`whatsapp-media.service.ts`) | Port to the same `IStorageService`/R2 backend with 7-day signed URLs | Currently bypasses `UnifiedStorageService` — refactor it to use the unified provider so it inherits the R2 backend. |
| R5 | `governance_approval_requests` deny-all RLS (`20250706000001`) | Already redundant (Prisma bypasses it); Express `authorize` middleware is the real control | Document & drop; no behavior change. |
| R6 | pgvector extension (`20240620000000`) | Unused — leave as no-op or drop | Not load-bearing (embeddings are JSON + in-app cosine). |
| R7 | Supabase-managed PgBouncer pooling (`DATABASE_URL` port 6543) | Target host's pooler, or PgBouncer sidecar | Only matters if staying on serverless; a long-lived Node server needs less pooling. |

---

## 3. Route map

**Key finding: there are NO Supabase data calls in the frontend to convert into routes.**
answer.md §8 confirms zero `.from()`/`.rpc()`/`.storage.`/`.auth.` — all CRUD/auth already
goes through existing Express routes via the `api` axios client. So the "route map" reduces
to **one new realtime endpoint**:

| Method / path | Purpose | Request | Response / stream | Auth |
|---|---|---|---|---|
| `GET /api/v1/realtime` (HTTP→WS upgrade) or `GET /api/v1/realtime/stream` (SSE) | Replace Supabase realtime subscription | On connect: JWT (existing access token) + businessId; optional `conversationId` to scope message stream | Server pushes events: `conversation_update {conversationId,type}`, `business_update {type,appointmentId?,campaignId?,customerId?,action?}`, and table-change signals for conversations/appointments/customers/notifications/messages (same shapes the UI already consumes) | Existing JWT middleware; server-side filter by `businessId`/`userId` (replaces the client-side `filter: businessId=eq.` — and is more secure, since filtering moves server-side) |

Frontend change: rewrite `apps/frontend/src/hooks/useRealtime.ts` to connect to this
endpoint instead of `getSupabase().channel(...)`, mapping the same events to the same
`queryClient.invalidateQueries(...)` calls. Delete `lib/supabase.ts` + `supabase-config.ts`
after cutover.

---

## 4. Migration order (recommended sequence + reasoning)

1. **Postgres host swap (schema/Prisma).** Point `DATABASE_URL`/`DIRECT_URL` at the new
   Postgres; `prisma migrate deploy`. *Reasoning:* schema is already plain Postgres — lowest
   risk, unblocks everything, verifiable immediately (app boots, CRUD works). Auth needs no
   change (custom JWT). Drop/no-op the `governance_rls` (R5) and `pgvector` (R6) migrations.
2. **Storage cutover.** Flip `UnifiedStorageService` to R2-primary (R3), refactor
   `whatsapp-media.service.ts` onto the unified provider (R4), and **bulk-copy existing
   objects** from Supabase Storage → R2 (both buckets). *Reasoning:* independent of realtime,
   medium risk; do it before removing Supabase entirely so signed URLs keep resolving during
   transition. Keep Supabase read-fallback until backfill verified.
3. **Realtime replacement (last).** Stand up the Express WS/SSE gateway (R1/R2) keeping
   `broadcast.service.ts` signatures. **Dual-run:** keep Supabase realtime active while the
   new gateway is validated in parallel; then switch `useRealtime.ts` to the new endpoint and
   remove the Supabase client + `supabase_realtime` publication. *Reasoning:* highest risk /
   only stateful piece; Vercel serverless can't hold sockets, so this may also force a
   long-lived Node host decision — do it once storage/DB are stable.
4. **Cleanup.** Remove `@supabase/supabase-js` from frontend, delete `lib/supabase*.ts`,
   drop `VITE_SUPABASE_*` env vars; on backend, remove Supabase clients once storage+realtime
   are off Supabase. Update `docs/VERCEL_SUPABASE.md`, `docs/ENVIRONMENT.md`.

---

## 5. Open questions / gaps (flagged, not dropped)

1. **Unverified RLS claim.** `docs/EMERGENCY_FIX_REPORT.md` says "RLS on all core tables,"
   but git shows only 1 deny-all policy. **Must inspect the live Supabase project** for
   dashboard-applied policies/functions not in the repo before concluding "nothing to port."
2. **Object inventory.** Unknown count/size of files already in `knowledge-documents` and
   `whatsapp-media` — needed to plan/schedule the R2 backfill (step 2).
3. **Realtime transport + host.** Decide WebSocket vs SSE, and the host for a long-lived Node
   process (Vercel serverless cannot hold persistent connections — likely Railway/Render/Fly,
   same place the BullMQ worker runs).
4. **Pooling.** Confirm the target Postgres provides PgBouncer-equivalent pooling if the API
   stays serverless (step 1/R7).
5. **AiTrainer auth.** `AiTrainer` is a separate auth principal (unique username, own login
   history) from `User`; confirm it's already fully custom-JWT (it appears to be) so it needs
   no Supabase-related work.

---

**STOP.** Awaiting review of this file and `backup-plan/answer.md` before any Express code is written.
