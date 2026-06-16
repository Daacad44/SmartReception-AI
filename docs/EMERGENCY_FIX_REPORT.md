# Emergency Fix Report — Auth 401 & Knowledge Upload 500

**Date:** 2026-06-16  
**Production URL:** https://smart-reception-ai.vercel.app  
**Supabase Project:** `hlngecipthlecwqozwhe`

---

## 1. Root Cause Report

### 401 Unauthorized (all protected endpoints)

**Primary root cause: Zustand persist hydration race**

On every page load/refresh, React Query hooks fired API requests **before** `localStorage` tokens were rehydrated into the Zustand auth store. During that window:

- `accessToken` was `null`
- Axios interceptor sent requests **without** `Authorization: Bearer <token>`
- Backend correctly returned `401 Unauthorized`
- React Query retried once (still before hydration) and stopped
- UI still showed the cached user name from persisted state → appeared "logged in" with broken APIs

**Contributing factors:**

- No `hasHydrated` / `sessionReady` gate on queries or `ProtectedRoute`
- Expired access tokens (15m TTL) could race with queries before proactive refresh
- Auth middleware caught all errors (including DB errors) as 401 — fixed to only map JWT failures to 401

**Verified:** Fresh login token works on production (`/auth/profile`, `/knowledge/bases` return 200). Backend JWT validation is correct when a token is present.

### 500 Internal Server Error (`POST /knowledge/documents/upload`)

**Root cause: `SUPABASE_SERVICE_ROLE_KEY` not set on Vercel**

- Storage bucket `knowledge-documents` exists in Supabase (private, 10MB limit)
- Backend upload uses Supabase Storage via service role key
- Without `SUPABASE_SERVICE_ROLE_KEY`, `UnifiedStorageService` throws → generic 500
- Reproduced with valid auth token: upload returns 500 while other endpoints return 200

---

## 2. Authentication Fix Report

| Fix | File |
|-----|------|
| `hasHydrated` + `onRehydrateStorage` callback | `apps/frontend/src/stores/auth.store.ts` |
| `sessionReady` flag after token refresh bootstrap | `apps/frontend/src/stores/auth.store.ts` |
| `AuthBootstrap` — proactive refresh of expired tokens | `apps/frontend/src/components/AuthBootstrap.tsx` |
| `useAuthReady()` — gates all authenticated queries | `apps/frontend/src/hooks/useAuthReady.ts` |
| Protected routes wait for hydration + session | `apps/frontend/src/components/ProtectedRoute.tsx` |
| Public routes wait for hydration before redirect | `apps/frontend/src/App.tsx` |
| All `useQuery` hooks use `enabled: authReady` | `apps/frontend/src/hooks/useApi.ts`, `useAuth.ts`, `useBusiness.ts` |
| JWT verify separated from DB lookup | `apps/backend/src/core/middleware/auth.middleware.ts` |

---

## 3. Authorization Fix Report

- Bearer token injection unchanged (correct); now guaranteed to run after session is ready
- Automatic token refresh on 401 via Axios interceptor (existing) + proactive refresh on load (new)
- `X-Business-Id` header still sent from `currentBusinessId`
- Role/permission checks via `authorize()` middleware unchanged (returns 403, not 401)

---

## 4. Supabase Audit Report

| Component | Status |
|-----------|--------|
| Project `hlngecipthlecwqozwhe` | ACTIVE_HEALTHY |
| Database (Prisma) | Connected on production |
| Auth | Custom JWT (not Supabase Auth) — working |
| Storage bucket `knowledge-documents` | Exists, private, 10MB |
| RLS on public tables | Policies present for all core tables |
| Storage RLS policies | Added via migration |

---

## 5. Storage Audit Report

| Item | Status |
|------|--------|
| Bucket `knowledge-documents` | ✅ Created |
| Private access | ✅ |
| MIME restrictions | PDF, DOC, DOCX, TXT |
| Backend upload path | `knowledge/{businessId}/{uuid}-filename` |
| Service role key on Vercel | ❌ **Must be set manually** |

---

## 6. Upload Fix Report

| Fix | Description |
|-----|-------------|
| Remove manual `Content-Type: multipart/form-data` | Prevents broken multipart boundary |
| Axios deletes Content-Type for `FormData` | `apps/frontend/src/lib/api.ts` |
| Storage errors return 503 with clear message | `ServiceUnavailableError` |
| Health endpoint reports storage config | `/health` |

---

## 7. SQL Migrations

- `apps/backend/prisma/migrations/20240616000001_storage_policies/migration.sql` — storage object policies
- Applied to remote Supabase via MCP

---

## 8. RLS Policies

Public schema tables already have business-scoped policies. Storage policies added for `knowledge-documents` bucket (service_role + authenticated).

---

## 9. Environment Variables Checklist

**Required on Vercel (Production):**

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Pooled URL with `?pgbouncer=true` |
| `DIRECT_URL` | ✅ | Direct connection for migrations |
| `JWT_SECRET` | ✅ | 64-char hex, never use dev default |
| `JWT_REFRESH_SECRET` | ✅ | 64-char hex |
| `NODE_ENV` | ✅ | `production` |
| `FRONTEND_URL` | ✅ | `https://smart-reception-ai.vercel.app` |
| `SUPABASE_URL` | ✅ | `https://hlngecipthlecwqozwhe.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ **CRITICAL** | From Supabase Dashboard → Settings → API |
| `VITE_API_URL` | ✅ | `/api/v1` |
| `VITE_SUPABASE_URL` | ✅ | Same as SUPABASE_URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Anon/publishable key |

**Verify after deploy:**

```bash
curl https://smart-reception-ai.vercel.app/health
# Expect: storage: "configured", auth: "configured", database: "connected"
```

---

## 10. Production Readiness Report

| Area | Status |
|------|--------|
| Auth hydration race | ✅ Fixed in code |
| Token refresh on load | ✅ Fixed in code |
| API 401 on refresh | ✅ Fixed (pending deploy) |
| Knowledge upload | ⚠️ Requires `SUPABASE_SERVICE_ROLE_KEY` on Vercel |
| Health diagnostics | ✅ Enhanced |
| Error responses | ✅ 503 for missing storage config |

### Post-deploy actions for operator

1. Add `SUPABASE_SERVICE_ROLE_KEY` in Vercel → Project Settings → Environment Variables
2. Redeploy production
3. Confirm `/health` shows `storage: "configured"`
4. Log out and log back in (clears any stale tokens)
5. Test knowledge base PDF upload
