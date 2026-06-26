# AGENTS.md

## Cursor Cloud specific instructions

SmartReception AI is an npm-workspaces monorepo (Node 20+). Standard commands live in
the root `package.json`, `apps/backend/package.json`, `apps/frontend/package.json`, and
`README.md` / `docs/DEPLOYMENT.md` — refer to those rather than duplicating them here.

### Services

| Service | Command (from repo root) | Port | Notes |
|---------|--------------------------|------|-------|
| Backend API (Express) | `npm run dev -w @smartreception/backend` | 3001 | `tsx watch`; health at `/health` |
| Background worker (BullMQ) | `npm run worker -w @smartreception/backend` | — | needs Redis |
| Frontend (Vite/React) | `npm run dev -w @smartreception/frontend` | 5173 | proxies `/api` → `:3001` |
| Both API + frontend | `npm run dev` | 3001 / 5173 | via `concurrently` |
| PostgreSQL 16 | `sudo pg_ctlcluster 16 main start` | 5432 | role/db `smartreception` / pw `smartreception_dev` |
| Redis 7 | `redis-server --daemonize yes` | 6379 | |

### Non-obvious startup caveats

- **Postgres and Redis are NOT auto-started.** They are installed in the VM image but
  have no running init system. Start them manually (see commands above) before running
  the backend/worker, then run `npm run db:push && npm run db:seed` only if the database
  is empty (data persists in the VM snapshot, so this is usually already done).
- **`.env` must exist in `apps/backend/`, not just the repo root.** The backend and all
  Prisma commands run with their cwd set to `apps/backend`, so `dotenv` and the Prisma
  CLI look for `apps/backend/.env`. Both `./.env` and `apps/backend/.env` exist in the
  snapshot (copied from `.env.example`); recreate them with `cp .env.example .env` and
  `cp .env apps/backend/.env` if missing. `.env` is gitignored.
- **Build `@smartreception/shared` before running the backend.** The backend imports it
  via its compiled `dist/` output (`main: ./dist/index.js`), so run
  `npm run build -w @smartreception/shared` after dependency changes.
- Lint = `npm run lint` (type-check only, `tsc --noEmit`). Full build = `npm run build`.

### Known pre-existing application bug (not an environment issue)

The authenticated frontend pages (Dashboard, Customers, etc.) were built against the
mock-data shapes in `apps/frontend/src/lib/mock-data.ts` and crash when fed the *real*
backend response shapes (e.g. `getInitials(conv.customerName)` throws because the API
returns a nested `customer` object, not a flat `customerName`). The `apiCall` "demo
mode" fallback only triggers on network errors, not on data-shape mismatches, so against
a live backend the dashboard renders blank. The login page and the backend API work end
to end; verify backend changes via the API directly (see `docs/API.md`).
