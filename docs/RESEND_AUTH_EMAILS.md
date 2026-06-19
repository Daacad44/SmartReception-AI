# Resend Authentication Email System

## Overview

SmartReception AI uses [Resend](https://resend.com) for all authentication emails, sent from **SmartReception AI <noreply@botandev.com>**.

## Environment Variables

```bash
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM_NAME=SmartReception AI
EMAIL_FROM_ADDRESS=noreply@botandev.com
EMAIL_SUPPORT=support@botandev.com
FRONTEND_URL=https://smart-reception-ai.vercel.app
```

SMTP remains available as a fallback if `RESEND_API_KEY` is not set.

## Email Types

| Email | Trigger |
|-------|---------|
| Email Verification | User registration |
| Resend Verification | `POST /auth/resend-verification` |
| Welcome | After email verified |
| Account Activated | After email verified |
| Password Reset | `POST /auth/forgot-password` (15 min expiry) |
| Password Changed | After successful password reset |
| Login Alert | After successful login |
| Team Invitation | `POST /team/invite` |

## Authentication Flow

### Registration
1. User registers → account created (unverified)
2. Verification email sent via Resend
3. **No JWT tokens returned** — user must verify first
4. User redirected to `/check-email`

### Email Verification
1. User clicks link: `/verify-email?token={TOKEN}`
2. Token validated (SHA-256 hashed in DB, 24h expiry, single use)
3. Welcome + Account Activated emails sent
4. User can now sign in

### Login
- Blocked with `403 EMAIL_NOT_VERIFIED` if email not verified
- Login alert email sent on success

### Password Reset
- Token expires in **15 minutes**, single use
- Tokens stored as SHA-256 hashes
- Password changed confirmation email sent after reset

## Security

- Verification and reset tokens are hashed before database storage
- Tokens are single-use and time-limited
- Auth events logged in `audit_logs`
- Password reset revokes all refresh tokens

## Frontend Routes

| Route | Purpose |
|-------|---------|
| `/verify-email` | Email verification handler |
| `/check-email` | Post-registration instructions + resend |
| `/forgot-password` | Request password reset |
| `/reset-password` | Set new password |

## Vercel Setup

1. Add `RESEND_API_KEY` in Vercel → Environment Variables
2. Verify domain `botandev.com` in Resend dashboard
3. Redeploy production
