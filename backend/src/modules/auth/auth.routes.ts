import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { createRateLimiter } from '../../core/rate-limit-store';

const router = Router();

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later',
  code: 'RATE_LIMITED',
});

// Dedicated brute-force rate limiter for the login endpoint:
// Requirement: Maximum 10 attempts per 15 minutes.
// Multi-vector strategy: Rate limit key combines normalized client IP and normalized email.
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts, please try again later',
  code: 'RATE_LIMITED',
  keyGenerator: (req) => {
    const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown-ip';
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : 'anonymous';
    return `login:${rawIp}:${email}`;
  },
});

router.post('/register', authLimiter, (req, res, next) => authController.register(req, res, next));
router.get('/check-email', authLimiter, (req, res, next) => authController.checkEmail(req, res, next));
// Login has a dedicated brute-force limiter (30 attempts / 15 min / IP).
router.post('/login', loginLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/verify-2fa', authLimiter, (req, res, next) => authController.verifyTwoFactor(req, res, next));
router.post('/verify-otp', authLimiter, (req, res, next) => authController.verifyOtp(req, res, next));
router.post('/resend-otp', authLimiter, (req, res, next) => authController.resendOtp(req, res, next));
router.post('/verify-approval', authLimiter, (req, res, next) => authController.verifyApprovalCode(req, res, next));
router.post('/resend-approval', authLimiter, (req, res, next) => authController.resendApprovalCode(req, res, next));
// Token refresh runs automatically during a normal session — not rate-limited
// so active users are never silently logged out.
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));
router.post('/logout', authenticate, (req, res, next) => authController.logout(req, res, next));
router.post('/forgot-password', authLimiter, (req, res, next) => authController.forgotPassword(req, res, next));
router.post('/reset-password', authLimiter, (req, res, next) => authController.resetPassword(req, res, next));
router.get('/profile', authenticate, (req, res, next) => authController.getProfile(req, res, next));
router.post('/switch-business', authenticate, (req, res, next) => authController.switchBusiness(req, res, next));

export default router;
