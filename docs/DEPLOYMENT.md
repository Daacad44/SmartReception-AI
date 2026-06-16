# SmartReception AI — Deployment Guide

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)
- Redis 7 (or use Docker)
- Cloudflare R2 bucket (or S3-compatible storage)
- OpenAI API key
- WhatsApp Business API credentials (Meta Developer account)

---

## Local Development

### 1. Clone and Install

```bash
git clone <repository-url>
cd smartreception-ai
cp .env.example .env
npm install
```

### 2. Configure Environment

Edit `.env` with your credentials:

```env
DATABASE_URL=postgresql://smartreception:smartreception_dev@localhost:5432/smartreception
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-dev-secret
OPENAI_API_KEY=sk-...
WHATSAPP_VERIFY_TOKEN=smartreception-verify
WHATSAPP_ACCESS_TOKEN=your-token
```

### 3. Start Infrastructure

```bash
docker-compose up -d postgres redis
```

### 4. Database Setup

```bash
npm run db:push        # Push schema to database
npm run db:seed        # Seed demo data
```

### 5. Start Development Servers

```bash
# Terminal 1: API server
npm run dev -w @smartreception/backend

# Terminal 2: Background workers
npm run worker -w @smartreception/backend

# Terminal 3: Frontend
npm run dev -w @smartreception/frontend

# Or all at once:
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001
- Health check: http://localhost:3001/health

### Demo Credentials

```
Email:    demo@smartreception.ai
Password: Demo1234!
```

---

## Docker Production Deployment

### Full Stack

```bash
# Set production environment variables
export JWT_SECRET=$(openssl rand -hex 32)
export JWT_REFRESH_SECRET=$(openssl rand -hex 32)
export OPENAI_API_KEY=sk-...
export WHATSAPP_ACCESS_TOKEN=...

docker-compose up -d
```

Services:
| Service | Port | Description |
|---------|------|-------------|
| frontend | 5173 | Nginx serving React build |
| backend | 3001 | Express API |
| worker | — | BullMQ background processors |
| postgres | 5432 | PostgreSQL database |
| redis | 6379 | Cache & job queue |

### Database Migrations (Production)

```bash
# Run inside backend container
docker exec smartreception-backend npx prisma migrate deploy
docker exec smartreception-backend npx tsx prisma/seed.ts
```

---

## Cloud Deployment (Vercel + Railway/Render)

### Frontend (Vercel)

1. Connect repository to Vercel
2. Set root directory to `apps/frontend`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Environment variables:
   ```
   VITE_API_URL=https://api.yourdomain.com
   ```

### Backend (Railway / Render / Fly.io)

1. Deploy from `apps/backend`
2. Set start command: `node dist/server.js`
3. Add worker process: `node dist/worker.js`
4. Attach PostgreSQL and Redis add-ons
5. Environment variables: see `.env.example`

### Recommended Production Settings

```env
NODE_ENV=production
JWT_SECRET=<64-char-random-hex>
JWT_REFRESH_SECRET=<64-char-random-hex>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
FRONTEND_URL=https://app.smartreception.ai
```

---

## WhatsApp Cloud API Setup

### 1. Meta Developer Account

1. Go to https://developers.facebook.com
2. Create an app with WhatsApp product
3. Add a phone number (test or production)
4. Generate a permanent access token

### 2. Configure Webhook

Set webhook URL in Meta dashboard:
```
https://api.yourdomain.com/api/v1/whatsapp/webhook
```

Verify token: value of `WHATSAPP_VERIFY_TOKEN`

Subscribe to: `messages`

### 3. Register in Platform

```bash
# Via API or dashboard settings
POST /api/v1/business/settings
{
  "whatsapp": {
    "phoneNumberId": "your-phone-number-id",
    "phoneNumber": "+1234567890",
    "wabaId": "your-waba-id",
    "accessToken": "your-access-token"
  }
}
```

---

## Cloudflare R2 Setup

1. Create R2 bucket in Cloudflare dashboard
2. Generate API tokens (S3-compatible)
3. Configure environment:

```env
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-key
R2_SECRET_ACCESS_KEY=your-secret
R2_BUCKET_NAME=smartreception
R2_PUBLIC_URL=https://your-bucket.r2.dev
```

---

## SSL & Domain

### Recommended Architecture

```
app.smartreception.ai  → Vercel (frontend)
api.smartreception.ai  → Railway/Render (backend)
```

### Nginx Reverse Proxy (self-hosted)

```nginx
server {
    listen 443 ssl;
    server_name api.smartreception.ai;

    ssl_certificate /etc/letsencrypt/live/api.smartreception.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.smartreception.ai/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Monitoring & Health

### Health Check

```bash
curl https://api.yourdomain.com/health
# { "status": "ok", "timestamp": "..." }
```

### Recommended Monitoring

- **Uptime:** UptimeRobot or Better Uptime on `/health`
- **Errors:** Sentry integration (add `SENTRY_DSN` env var)
- **Logs:** Winston logs to stdout; ship with Datadog/Logtail
- **Queue:** Monitor BullMQ queue depths via Redis CLI
- **Database:** Prisma query logging in development; pg_stat in production

---

## Scaling Considerations

| Component | Scale Strategy |
|-----------|---------------|
| API | Horizontal — multiple instances behind load balancer |
| Workers | Horizontal — increase concurrency or add worker instances |
| PostgreSQL | Read replicas for analytics queries |
| Redis | Redis Cluster for high availability |
| R2 | Auto-scales (object storage) |
| OpenAI | Rate limits per API key; consider multiple keys |

### Database Indexes

The Prisma schema includes indexes on all frequently queried columns:
- `businessId` on every tenant table
- Composite indexes for common query patterns
- `whatsappMsgId` unique constraint for deduplication

---

## Backup Strategy

```bash
# PostgreSQL daily backup
pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d).sql.gz

# R2 versioning enabled on bucket
# Redis: persistence via AOF (appendonly yes)
```
