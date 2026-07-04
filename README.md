# SmartReception AI

**Enterprise-grade AI-powered WhatsApp business automation platform.**

SmartReception AI enables businesses to automate customer support, appointment booking, lead management, and CRM through intelligent WhatsApp conversations powered by OpenAI.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-green.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)

## Features

- **Multi-Tenant Architecture** — Unlimited businesses from a single codebase with `business_id` isolation
- **WhatsApp Inbox** — Real-time 3-pane conversation management
- **AI Assistant** — GPT-powered auto-replies with knowledge base retrieval
- **Appointment Booking** — AI-driven scheduling with calendar view and reminders
- **Customer CRM** — Profiles, tags, notes, and interaction history
- **Knowledge Base** — PDF/DOCX/TXT upload with AI-powered search
- **Analytics Dashboard** — KPIs, trends, team performance metrics
- **Team Management** — Role-based access control (RBAC) with invitations
- **Billing** — Subscription plans and invoice management

## Target Industries

Clinics, Hospitals, Hotels, Restaurants, Salons, Universities, Travel Agencies, Real Estate, Consulting, and Service Businesses.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, TypeScript, TailwindCSS, shadcn/ui |
| Backend | Node.js, Express.js, TypeScript, Prisma ORM |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Queue | BullMQ |
| Storage | Cloudflare R2 |
| AI | OpenAI GPT-4o-mini |
| Messaging | WhatsApp Cloud API |
| Auth | JWT + Refresh Tokens, RBAC |

## Quick Start

```bash
# Clone and install
git clone <repo-url> && cd smartreception-ai
cp .env.example .env
npm install

# Start infrastructure
docker-compose up -d postgres redis

# Setup database
npm run db:push && npm run db:seed

# Start development
npm run dev
```

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3001
- **Demo login:** `demo@smartreception.ai` / `Demo1234!`

## Project Structure

```
smartreception-ai/
├── backend/                     # Express API + BullMQ workers
│   ├── prisma/
│   │   ├── schema.prisma        # Full database schema (16 tables)
│   │   └── seed.ts              # Demo data seeder
│   └── src/
│       ├── config/              # Environment config
│       ├── core/                # Errors, logger, middleware
│       ├── infrastructure/      # Prisma, Redis, R2, OpenAI, WhatsApp
│       ├── modules/             # Feature modules (11 modules)
│       ├── routes/              # API route aggregator
│       ├── app.ts               # Express app factory
│       ├── server.ts            # HTTP server
│       └── worker.ts            # Background job processors
├── frontend/                    # React dashboard
│   └── src/
│       ├── components/          # UI components + layout
│       ├── pages/               # 10 page views
│       ├── stores/              # Zustand state
│       ├── hooks/               # Custom React hooks
│       └── lib/                 # API client, utilities
├── packages/
│   └── shared/                  # Shared types, schemas, constants
├── docs/
│   ├── ARCHITECTURE.md          # System architecture
│   ├── API.md                   # REST API documentation
│   ├── WORKFLOWS.md             # Auth, WhatsApp, AI, CRM flows
│   └── DEPLOYMENT.md            # Deployment guide
├── docker-compose.yml           # Full stack orchestration
└── package.json                 # npm workspaces root
```

## API Modules

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Auth | 9 | Register, login, JWT refresh, password reset |
| Business | 4 | Profile and settings management |
| Customers | 8 | CRM with tags, notes, search |
| Conversations | 6 | WhatsApp inbox, messaging, takeover |
| Appointments | 6 | Booking, calendar, availability |
| Services | 4 | Business service catalog |
| Knowledge | 6 | Document upload, FAQ management |
| AI | 2 | AI assistant configuration |
| Analytics | 5 | Dashboard stats and trends |
| Team | 5 | Invitations, roles, permissions |
| WhatsApp | 2 | Webhook verification and processing |

## Database Schema

16 production-ready tables with full relationships and indexes:

`Businesses` · `Users` · `BusinessMembers` · `Customers` · `CustomerTags` · `Conversations` · `Messages` · `Appointments` · `Services` · `KnowledgeBases` · `KnowledgeDocuments` · `WhatsAppAccounts` · `Notifications` · `AuditLogs` · `Subscriptions` · `Invoices` · `AIConfigurations`

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — Clean architecture, multi-tenancy, security
- [API Reference](docs/API.md) — Complete REST API documentation
- [Workflows](docs/WORKFLOWS.md) — Auth, WhatsApp, AI, booking, CRM flows
- [Deployment](docs/DEPLOYMENT.md) — Local, Docker, and cloud deployment

## Security

- JWT access tokens (15m) + rotating refresh tokens (7d)
- bcrypt password hashing (12 rounds)
- Role-based access control (5 roles, 17 permissions)
- Rate limiting, Helmet headers, CORS, input validation
- Audit logging for all sensitive operations
- Multi-tenant data isolation at every layer

## License

MIT
