import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { createLoginRateLimiters, createRateLimiter } from '../../core/rate-limit-store';

const router = Router();

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later',
});

// Dual limiter: 10 / 15 min per IP and per normalized email. Changing only
// one of those values cannot bypass the other.
const loginLimiters = createLoginRateLimiters();

router.post('/register', authLimiter, (req, res, next) => authController.register(req, res, next));
router.get('/check-email', authLimiter, (req, res, next) => authController.checkEmail(req, res, next));
router.post('/login', ...loginLimiters, (req, res, next) => authController.login(req, res, next));
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
