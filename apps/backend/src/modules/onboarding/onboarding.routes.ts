import { Router } from 'express';
import { onboardingController } from './onboarding.controller';
import { authenticate } from '../../core/middleware/auth.middleware';

const router = Router();

router.get('/business-types', (req, res, next) => onboardingController.businessTypes(req, res, next));

router.use(authenticate);

router.get('/status', (req, res, next) => onboardingController.status(req, res, next));
router.post('/business', (req, res, next) => onboardingController.businessInfo(req, res, next));
router.patch('/profile', (req, res, next) => onboardingController.profile(req, res, next));
router.patch('/discovery', (req, res, next) => onboardingController.discovery(req, res, next));
router.post('/plan', (req, res, next) => onboardingController.plan(req, res, next));
router.post('/whatsapp', (req, res, next) => onboardingController.whatsapp(req, res, next));
router.post('/complete', (req, res, next) => onboardingController.complete(req, res, next));
router.post('/welcome-seen', (req, res, next) => onboardingController.welcomeSeen(req, res, next));

export default router;
