# Vercel + Supabase Deployment

## Supabase Project

| Setting | Value |
|---------|-------|
| **Project Name** | SmartReception AI |
| **Project ID** | `hlngecipthlecwqozwhe` |
| **Region** | eu-west-1 |
| **API URL** | https://hlngecipthlecwqozwhe.supabase.co |
| **Database Host** | db.hlngecipthlecwqozwhe.supabase.co |

### Connection Strings

Get your database password from [Supabase Dashboard](https://supabase.com/dashboard/project/hlngecipthlecwqozwhe/settings/database).

**Pooled (for Vercel serverless — `DATABASE_URL`):**
```
postgresql://postgres.hlngecipthlecwqozwhe:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Direct (for migrations — `DIRECT_URL`):**
```
postgresql://postgres:[PASSWORD]@db.hlngecipthlecwqozwhe.supabase.co:5432/postgres
```

### Demo Credentials

```
Email:    demo@smartreception.ai
Password: Demo1234!
```

---

## Vercel Deployment

### Required Environment Variables

Set these in [Vercel Project Settings → Environment Variables](https://vercel.com/docs/projects/environment-variables):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase pooled connection string (port 6543) |
| `DIRECT_URL` | Supabase direct connection string (port 5432) |
| `JWT_SECRET` | Random 64-char hex string |
| `JWT_REFRESH_SECRET` | Random 64-char hex string |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | Your Vercel deployment URL (e.g. `https://smartreception.vercel.app`) |
| `OPENAI_API_KEY` | OpenAI API key (optional, for AI features) |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp webhook verify token |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Cloud API token (optional) |
| `REDIS_URL` | Upstash Redis URL (optional, for background jobs) |

### Deploy

```bash
# Via Vercel CLI
npm i -g vercel
vercel --prod

# Or connect GitHub repo in Vercel Dashboard
# Root directory: / (monorepo root)
# Build command: npm run build:vercel
# Output directory: apps/frontend/dist
```

### Architecture on Vercel + Supabase

```
Browser → Vercel (React SPA + Express API serverless)
                ↓
         Supabase PostgreSQL (pooled via PgBouncer)
```

- **Frontend**: Static files served from `apps/frontend/dist`
- **API**: Express app at `/api` serverless function, routes at `/api/v1/*`
- **Database**: Supabase PostgreSQL with Prisma ORM
- **Background jobs**: Require Upstash Redis (optional; API works without it)

### Post-Deploy Checklist

1. Set all environment variables in Vercel
2. Verify health: `curl https://your-app.vercel.app/health`
3. Test login: `POST https://your-app.vercel.app/api/v1/auth/login`
4. Configure WhatsApp webhook URL: `https://your-app.vercel.app/api/v1/whatsapp/webhook`
