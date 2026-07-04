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
postgresql://postgres.hlngecipthlecwqozwhe:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=3&pool_timeout=20
```

> **Prisma P2024 fix:** Do not use `connection_limit=1` on Vercel unless you serialize all DB access.
> Warm serverless instances handle concurrent requests (health + webhook + API). Use `connection_limit=3`
> with Supabase transaction pooler (port 6543). `DIRECT_URL` is for migrations only (port 5432).

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

> **Important:** In Vercel Project Settings → General → **Root Directory**, leave it empty (repository root `.`).
> Do **not** set it to `frontend` unless you only want the static frontend without the API.

### Required Environment Variables

Set these in [Vercel Project Settings → Environment Variables](https://vercel.com/docs/projects/environment-variables):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase pooled connection string (port 6543) |
| `DIRECT_URL` | Supabase direct connection string (port 5432) |
| `DATABASE_CONNECTION_LIMIT` | Optional; default `3` on Vercel (avoid P2024 pool timeouts) |
| `DATABASE_POOL_TIMEOUT` | Optional; default `20` seconds |
| `JWT_SECRET` | Random 64-char hex string |
| `JWT_REFRESH_SECRET` | Random 64-char hex string |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | Your Vercel deployment URL (e.g. `https://smartreception.vercel.app`) |
| `OPENAI_API_KEY` | OpenAI API key (optional, for AI features) |
| `WHATSAPP_VERIFY_TOKEN` | WhatsApp webhook verify token |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Cloud API token (optional) |
| `WHATSAPP_WEBHOOK_URL` | `https://api.somreception.botandev.com/api/v1/webhooks/whatsapp` |
| `REDIS_URL` | Upstash Redis URL (optional, for background jobs) |
| `VITE_API_URL` | `/api/v1` |
| `VITE_SUPABASE_URL` | `https://hlngecipthlecwqozwhe.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (publishable) key from Project Settings → API |
| `SUPABASE_URL` | `https://hlngecipthlecwqozwhe.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend storage uploads) |
| `RESEND_API_KEY` | Resend API key for authentication emails |
| `EMAIL_FROM_NAME` | `SmartReception AI` |
| `EMAIL_FROM_ADDRESS` | `noreply@botandev.com` |
| `EMAIL_SUPPORT` | `support@botandev.com` |

### Local development

Copy the frontend env template and add your anon key (file is gitignored):

```bash
cp frontend/.env.example frontend/.env.local
# Edit frontend/.env.local — set VITE_SUPABASE_ANON_KEY from Supabase Dashboard → API
```

Never commit `.env.local` or root `.env` — they are listed in `.gitignore`.

```bash
# Via Vercel CLI
npm i -g vercel
vercel --prod

# Or connect GitHub repo in Vercel Dashboard
# Root directory: / (monorepo root)
# Build command: npm run build:vercel
# Output directory: frontend/dist
```

### Architecture on Vercel + Supabase

```
Browser → Vercel (React SPA + Express API serverless)
                ↓
         Supabase PostgreSQL (pooled via PgBouncer)
```

- **Frontend**: Static files served from `frontend/dist`
- **API**: Express app at `/api` serverless function, routes at `/api/v1/*`
- **Database**: Supabase PostgreSQL with Prisma ORM
- **Background jobs**: Require Upstash Redis (optional; API works without it)

### Post-Deploy Checklist

1. Set all environment variables in Vercel
2. Verify health: `curl https://your-app.vercel.app/health`
3. Test login: `POST https://your-app.vercel.app/api/v1/auth/login`
4. Configure WhatsApp webhook URL: `https://your-app.vercel.app/api/v1/webhooks/whatsapp`
