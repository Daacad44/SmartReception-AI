# Resend Authentication Email System

## Overview

SmartReception AI uses [Resend](https://resend.com) for authentication emails, sent from **SmartReception AI <noreply@botandev.com>**.

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
| OTP Verification | User registration |
| OTP Resend | `POST /auth/resend-otp` |
| Welcome | After OTP verification |
| Account Activated | After OTP verification |
| Password Reset OTP | `POST /auth/forgot-password` (10 min expiry) |
| Password Changed | After successful password reset |
| Login Alert | After successful login |
| Team Invitation | `POST /team/invite` |

## Authentication Flow

### Registration
1. User registers → account created (unverified)
2. 6-digit OTP sent via Resend
3. **No JWT tokens returned** — user must verify first
4. User redirected to `/verify-otp`

### Email Verification (OTP)
1. User enters email + OTP on `/verify-otp`
2. Code validated (SHA-256 hashed in DB, 10 min expiry, max 5 attempts)
3. Welcome + Account Activated emails sent
4. User can now sign in

### Login
- Blocked with `403 EMAIL_NOT_VERIFIED` if email not verified
- Login alert email sent on success
- Failed attempts trigger account lockout (5 attempts, 15 min)

### Password Reset
- OTP expires in **10 minutes**, max 5 attempts
- Codes stored as SHA-256 hashes
- Password changed confirmation email sent after reset

## Security

- OTP codes are hashed before database storage
- Codes are time-limited with attempt limits
- Auth events logged in `audit_logs`
- Password reset revokes all refresh tokens

## Frontend Routes

| Route | Purpose |
|-------|---------|
| `/verify-otp` | Enter email verification code |
| `/forgot-password` | Request password reset OTP |
| `/reset-password` | Set new password with OTP |

## Vercel Setup

1. Add `RESEND_API_KEY` in Vercel → Environment Variables
2. Verify domain `botandev.com` in Resend dashboard
3. Redeploy production
