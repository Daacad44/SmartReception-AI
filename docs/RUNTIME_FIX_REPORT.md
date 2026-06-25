# Runtime Data Loading Fix Report

## Root Cause Analysis

### 1. Dashboard infinite loading
- **Cause:** Dashboard fired **7 parallel API requests** on mount, each triggering a separate Vercel serverless cold start. Combined with React Query v5 `isLoading` not reflecting disabled-query state correctly, widgets appeared stuck in skeleton state.
- **Evidence:** Production `/analytics/dashboard` took ~6s alone; 7 parallel calls amplified latency and timeout risk (15s axios default).

### 2. Analytics charts empty / not rendering
- **Cause:** Charts rendered with all-zero data but no empty state UI. Pie chart with 0% channels failed silently. No error fallback when API failed.
- **Data source:** Live Prisma queries — not fake data. Demo tenant has minimal records so charts show zeros legitimately.

### 3. Auth hydration race
- **Cause:** `HydrationGate` used 800ms timeout before Zustand persist finished, causing routes to render before auth state was restored. Queries gated on `useAuthReady` never fired or fired with stale state.

### 4. Knowledge base upload instability
- **Cause:** `POST /documents/:id/process` **awaited full document processing** in the request handler, causing timeouts on Vercel serverless.

---

## Fixes Applied

### Backend
| File | Change |
|------|--------|
| `analytics.repository.ts` | Single SQL query for dashboard stats (was 16 round trips) |
| `analytics.service.ts` | Added `getDashboardBundle()` — one HTTP call for all dashboard data |
| `analytics.routes.ts` | `GET /analytics/dashboard-bundle` |
| `knowledge.service.ts` | `processDocument` schedules async processing, returns immediately |

### Frontend
| File | Change |
|------|--------|
| `HydrationGate.tsx` | Wait for Zustand `persist.onFinishHydration` before rendering |
| `useAuthQuery.ts` | Auth-gated queries + `isInitialLoading()` helper |
| `QuerySection.tsx` | Reusable loading/error/empty chart states |
| `useApi.ts` | All hooks use `useAuthQuery`; 30s analytics timeout |
| `DashboardPage.tsx` | Single `useDashboardBundle()` call; per-section error/empty states |
| `AnalyticsPage.tsx` | Empty chart fallbacks; retry on error |
| `KnowledgeBasePage.tsx` | Fixed loading detection; retry on error |
| `App.tsx` | Query client: 2 retries, exponential backoff, 60s staleTime |

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/analytics/dashboard-bundle` | All dashboard metrics in one request |
| `GET /api/v1/analytics/dashboard` | KPI stats only (optimized) |
| `GET /api/v1/analytics` | Full analytics page data |
| `POST /api/v1/knowledge/documents/:id/process` | Non-blocking processing trigger |

---

## Verification

- [x] `npm run build:vercel` passes
- [x] Production login + analytics endpoints return 200
- [x] Dashboard bundle reduces 7 HTTP calls → 1
- [x] Charts show empty state when data is zero (not infinite skeleton)
- [x] Knowledge process endpoint returns without blocking

---

## Remaining Recommendations

1. Add Upstash Redis for reliable background document processing on Vercel
2. Consider materialized views for analytics at scale
3. Add pgvector for embedding-based knowledge retrieval
