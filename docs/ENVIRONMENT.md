# Environment Variables

All secrets must be set in `.env` (local) or your hosting provider (Vercel, Railway, etc.).  
**Never commit real values.** Copy `.env.example` to `.env` and fill in your keys locally.

`.env`, `.env.local`, `.env.production`, and all other `.env.*` files are gitignored.

## Required for core operation

| Variable | Where | Description |
|----------|-------|-------------|
| `DATABASE_URL` | Backend | Supabase pooler connection (port 6543) |
| `DIRECT_URL` | Backend | Direct Postgres for migrations (port 5432) |
| `JWT_SECRET` | Backend | Access token signing secret |
| `JWT_REFRESH_SECRET` | Backend | Refresh token signing secret |
| `RESEND_API_KEY` | Backend | OTP and team invite emails |
| `FRONTEND_URL` | Backend | CORS + email links |
| `VITE_API_URL` | Frontend | API base path (e.g. `/api/v1`) |

## Supabase (storage + realtime)

| Variable | Where | Description |
|----------|-------|-------------|
| `SUPABASE_URL` | Backend + Frontend | Project URL |
| `SUPABASE_ANON_KEY` | Backend + Frontend | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend only | Storage uploads (server-side) |
| `VITE_SUPABASE_URL` | Frontend | Same as SUPABASE_URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Same as anon key |

Enable Realtime in Supabase Dashboard for: `conversations`, `messages`, `appointments`, `customers`, `notifications`.

## Stripe (billing)

| Variable | Where | Description |
|----------|-------|-------------|
| `STRIPE_SECRET_KEY` | Backend | Secret API key |
| `STRIPE_WEBHOOK_SECRET` | Backend | Webhook signing secret |
| `STRIPE_PRICE_*` | Backend | Price IDs per plan tier |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Frontend | Publishable key |

Webhook: `https://<domain>/api/v1/billing/webhook`

## OpenAI

| Variable | Where | Description |
|----------|-------|-------------|
| `OPENAI_API_KEY` | Backend | GPT + embeddings |
| `OPENAI_MODEL` | Backend | Default `gpt-4o-mini` |

## WhatsApp

| Variable | Where | Description |
|----------|-------|-------------|
| `WHATSAPP_VERIFY_TOKEN` | Backend | Meta webhook verify token |
| `WHATSAPP_APP_SECRET` | Backend | Webhook signature verification |
| `WHATSAPP_ACCESS_TOKEN` | Backend | Optional global fallback |

Webhook: `https://<domain>/api/v1/whatsapp/webhook`

## Optional

| Variable | Where | Description |
|----------|-------|-------------|
| `REDIS_URL` | Backend | BullMQ worker + distributed rate limits |
