# Environment Variables Required

All credentials must be stored in `.env` files. `.env` is listed in `.gitignore` and must never be committed.

Copy `.env.example` to `.env` and fill in real values.

## WhatsApp Cloud API (Required for Production)

| Variable | Description | Example |
|----------|-------------|---------|
| `VERIFY_TOKEN` | Webhook verification token (you choose this value) | `my-secure-random-token` |
| `WHATSAPP_VERIFY_TOKEN` | Alias for `VERIFY_TOKEN` | Same as above |
| `WHATSAPP_ACCESS_TOKEN` | Permanent System User access token | From Meta Business Settings |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID from WhatsApp API setup | `123456789012345` |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Business Account ID (WABA) | `987654321098765` |
| `META_APP_ID` | Meta application ID | From app dashboard |
| `META_APP_SECRET` | Meta app secret (for webhook signature) | From app dashboard |
| `WHATSAPP_APP_SECRET` | Alias for `META_APP_SECRET` | Same as above |
| `WHATSAPP_API_VERSION` | Graph API version | `v21.0` (default) |

## Application URLs (Production)

| Variable | Value |
|----------|-------|
| `API_URL` | `https://api.somreception.botandev.com` |
| `FRONTEND_URL` | `https://somreception.botandev.com` |

## Supabase (Required for Media + Realtime)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | Public anon key (frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (backend media upload) |
| `DATABASE_URL` | Pooled Postgres connection |
| `DIRECT_URL` | Direct Postgres for migrations |

## Supporting Services

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | BullMQ queues for async WhatsApp send + AI |
| `OPENAI_API_KEY` | AI auto-replies |
| `JWT_SECRET` | API authentication |

## Where to Set Variables

| Environment | Location |
|-------------|----------|
| Local development | `/workspace/.env` or `apps/backend/.env` |
| Production API | Hosting provider env (e.g. Vercel, Railway) for `api.somreception.botandev.com` |
| Production frontend | `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

## Credential Request

Before connecting WhatsApp in production, provide:

1. `WHATSAPP_ACCESS_TOKEN`
2. `WHATSAPP_PHONE_NUMBER_ID`
3. `WHATSAPP_BUSINESS_ACCOUNT_ID`
4. `WHATSAPP_APP_SECRET` / `META_APP_SECRET`
5. `META_APP_ID`
6. `VERIFY_TOKEN` (or confirm a value you want to use)

Store these only in `.env` on the API server. Never commit them to git or paste them into frontend code.

## Connect from Environment

Once variables are set on the API host:

1. Log in to SmartReception
2. Go to **Settings → WhatsApp**
3. Click **Connect from Environment**

This reads `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, and `WHATSAPP_BUSINESS_ACCOUNT_ID` from the server environment and registers the account for your business.
