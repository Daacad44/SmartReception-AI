import { Router } from 'express';
import { billingController } from './billing.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/', authorize(PERMISSIONS['billing:read']), (req, res, next) =>
  billingController.getOverview(req, res, next)
);
router.post('/change-plan', authorize(PERMISSIONS['billing:write']), (req, res, next) =>
  billingController.changePlan(req, res, next)
);

export default router;
