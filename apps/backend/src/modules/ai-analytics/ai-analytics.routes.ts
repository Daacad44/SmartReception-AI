import { Router } from 'express';
import { aiAnalyticsController } from './ai-analytics.controller';
import { authorize } from '../../core/middleware/authorize.middleware';

const router = Router();

router.get(
  '/dashboard',
  authorize('analytics:read'),
  (req, res, next) => aiAnalyticsController.businessDashboard(req, res, next)
);

router.get(
  '/customers/:customerId',
  authorize('analytics:read'),
  (req, res, next) => aiAnalyticsController.customerAnalytics(req, res, next)
);

router.get(
  '/conversations/:conversationId',
  authorize('analytics:read'),
  (req, res, next) => aiAnalyticsController.conversationAnalytics(req, res, next)
);

export default router;
