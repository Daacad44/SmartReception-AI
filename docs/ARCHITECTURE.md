# SmartReception AI — Architecture

## Overview

SmartReception AI is a multi-tenant SaaS platform for WhatsApp business automation. A single codebase serves unlimited businesses with strict data isolation via `business_id` on every tenant-scoped table.

## Monorepo Structure

```
smartreception-ai/
├── apps/
│   ├── backend/          # Express.js API + BullMQ workers
│   └── frontend/         # React + Vite dashboard
├── packages/
│   └── shared/           # Shared types, Zod schemas, constants
├── docs/                 # Documentation
├── docker-compose.yml    # Local & production stack
└── package.json          # npm workspaces root
```

## Backend Architecture (Clean Architecture)

```
apps/backend/src/
├── config/               # Environment configuration
├── core/                 # Cross-cutting concerns
│   ├── errors.ts         # AppError hierarchy
│   ├── logger.ts         # Winston logger
│   ├── error-handler.ts  # Global error middleware
│   └── middleware/       # Auth, authorize, validate
├── infrastructure/       # External service adapters
│   ├── database/         # Prisma client
│   ├── cache/            # Redis
│   ├── queue/            # BullMQ queues
│   ├── storage/          # Cloudflare R2 (S3-compatible)
│   ├── auth/             # JWT + password hashing
│   ├── email/            # Nodemailer
│   ├── ai/               # OpenAI integration
│   └── whatsapp/         # WhatsApp Cloud API
├── modules/              # Feature modules (vertical slices)
│   ├── auth/
│   ├── business/
│   ├── customers/
│   ├── conversations/
│   ├── appointments/
│   ├── knowledge/
│   ├── analytics/
│   ├── team/
│   ├── whatsapp/
│   ├── ai/
│   └── services/
├── routes/               # Route aggregator
├── app.ts                # Express application factory
├── server.ts             # HTTP server entry
└── worker.ts             # Background job processors
```

### Module Pattern (per feature)

Each module follows the same layered structure:

```
modules/{feature}/
├── {feature}.repository.ts   # Data access (Prisma queries)
├── {feature}.service.ts      # Business logic
├── {feature}.controller.ts   # HTTP request/response handling
└── {feature}.routes.ts       # Express router + middleware chain
```

**Dependency flow:** Routes → Controller → Service → Repository → Prisma

## Frontend Architecture

```
apps/frontend/src/
├── components/
│   ├── ui/               # shadcn/ui primitives
│   └── layout/           # Sidebar, TopBar, DashboardLayout
├── pages/                # Route-level page components
├── hooks/                # useAuth, useApi, useBusiness
├── stores/               # Zustand (auth state)
├── lib/                  # API client, utilities
├── App.tsx               # Router configuration
└── main.tsx              # Entry point
```

## Multi-Tenancy

| Layer | Isolation Mechanism |
|-------|---------------------|
| Database | `businessId` FK on all tenant tables |
| API | JWT contains `businessId`; middleware enforces scope |
| Queries | Every repository method filters by `businessId` |
| Storage | R2 keys prefixed with `businessId/` |
| Queues | Job payloads include `businessId` |

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TypeScript, TailwindCSS, shadcn/ui |
| State | Zustand (auth), React Query (server state) |
| Forms | React Hook Form + Zod |
| Backend | Node.js 20+, Express.js, TypeScript |
| ORM | Prisma 6 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Queue | BullMQ |
| Storage | Cloudflare R2 |
| AI | OpenAI GPT-4o-mini |
| Messaging | WhatsApp Cloud API |
| Auth | JWT + Refresh Tokens, RBAC |

## Security Layers

1. **Helmet** — HTTP security headers
2. **CORS** — Origin-restricted
3. **Rate Limiting** — Global + auth-specific limits
4. **JWT** — Short-lived access tokens (15m)
5. **Refresh Tokens** — Rotating, revocable (7d)
6. **RBAC** — Role-based permissions per business
7. **Input Validation** — Zod schemas on all endpoints
8. **Password Hashing** — bcrypt (12 rounds)
9. **Audit Logs** — All sensitive actions logged
10. **SQL Injection** — Prisma parameterized queries

## RBAC Roles

| Role | Description |
|------|-------------|
| OWNER | Full access including billing |
| ADMIN | Full access except billing write |
| MANAGER | Operations + analytics |
| AGENT | Conversations + customers + appointments |
| VIEWER | Read-only access |
