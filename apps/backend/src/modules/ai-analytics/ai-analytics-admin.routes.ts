import { Router } from 'express';
import { aiAnalyticsController } from './ai-analytics.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { requireSuperAdmin } from '../../core/middleware/super-admin.middleware';

const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get('/businesses', (req, res, next) =>
  aiAnalyticsController.superAdminBusinesses(req, res, next)
);

router.get('/businesses/:businessId', (req, res, next) =>
  aiAnalyticsController.superAdminBusinessDetail(req, res, next)
);

router.get('/platform', (req, res, next) =>
  aiAnalyticsController.platformDashboard(req, res, next)
);

router.post('/backfill', (req, res, next) =>
  aiAnalyticsController.backfill(req, res, next)
);

export default router;
