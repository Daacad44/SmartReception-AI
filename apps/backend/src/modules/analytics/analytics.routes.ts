import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/dashboard', authorize(PERMISSIONS['analytics:read']), (req, res, next) =>
  analyticsController.dashboard(req, res, next)
);
router.get('/trends', authorize(PERMISSIONS['analytics:read']), (req, res, next) =>
  analyticsController.trends(req, res, next)
);
router.get('/team-performance', authorize(PERMISSIONS['analytics:read']), (req, res, next) =>
  analyticsController.teamPerformance(req, res, next)
);

export default router;
