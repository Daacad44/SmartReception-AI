# SmartReception AI — Admin Guide

## Roles & Permissions

| Role | Billing | Team | Analytics | Knowledge | Appointments | Settings |
|------|---------|------|-----------|-----------|--------------|----------|
| OWNER | Full | Full | Full | Full | Full | Full |
| MANAGER | Read | Read/Write | Read | Read/Write | Full | Read |
| AGENT | — | — | — | Read | Read/Write | Read |

Unauthorized routes redirect to the dashboard. Sidebar items are hidden based on the same permissions.

## Billing Administration

1. Set Stripe keys in environment (see `docs/ENVIRONMENT.md`).
2. Configure webhook: `POST /api/v1/billing/webhook`
3. Map price IDs: `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PROFESSIONAL`, `STRIPE_PRICE_ENTERPRISE`
4. Users upgrade via **Billing → Upgrade** (Stripe Checkout).
5. Manage subscriptions via **Customer Portal**.
6. Admin-only `POST /billing/change-plan` works without Stripe for internal overrides.

Subscription enforcement blocks writes when status is `PAST_DUE`, `CANCELLED`, or `EXPIRED`.

## WhatsApp Setup

1. Create a Meta app with WhatsApp Business API.
2. In **Settings → WhatsApp**, connect phone number ID and business account ID.
3. Copy webhook URL and verify token from `/whatsapp/webhook-info`.
4. Set `WHATSAPP_APP_SECRET` for signature verification.
5. Deploy a worker with `REDIS_URL` for outbound message queue.

## Knowledge Base

- Upload PDF, DOCX, or TXT documents.
- Documents are chunked, embedded (requires `OPENAI_API_KEY`), and indexed.
- Semantic search: `GET /knowledge/search?q=...`
- Notifications fire on index complete and document delete.

## Notifications

In-app notifications appear in the top bar. Types:

- **MESSAGE** — inbound WhatsApp message
- **APPOINTMENT** — created, updated, cancelled
- **TEAM** — invitation sent
- **BILLING** — subscription and invoice events
- **SYSTEM** — knowledge base events

Enable Supabase Realtime on the `notifications` table for live updates.

## Security Checklist

- [ ] Strong `JWT_SECRET` and `JWT_REFRESH_SECRET` (production boot fails on defaults)
- [ ] `RESEND_API_KEY` for OTP emails
- [ ] HttpOnly auth cookies enabled
- [ ] Redis for distributed rate limiting (`REDIS_URL`)
- [ ] CSP and HSTS headers (Vercel + Express)
- [ ] Webhook signature verification (Stripe + WhatsApp)

## Worker Deployment

See `docs/WORKER_DEPLOYMENT.md` for BullMQ worker setup (WhatsApp send, document processing).
