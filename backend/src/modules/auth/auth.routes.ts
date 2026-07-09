import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { createRateLimiter } from '../../core/rate-limit-store';

const router = Router();

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

router.post('/register', authLimiter, (req, res, next) => authController.register(req, res, next));
router.get('/check-email', authLimiter, (req, res, next) => authController.checkEmail(req, res, next));
// Login is intentionally not rate-limited: users must be able to sign in and
// out at any time without hitting a "too many requests" wall.
router.post('/login', (req, res, next) => authController.login(req, res, next));
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
