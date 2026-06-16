import { Router } from 'express';
import { businessController } from './business.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/', authorize(PERMISSIONS['business:read']), (req, res, next) =>
  businessController.get(req, res, next)
);
router.patch('/', authorize(PERMISSIONS['business:write']), (req, res, next) =>
  businessController.update(req, res, next)
);
router.get('/settings', authorize(PERMISSIONS['settings:read']), (req, res, next) =>
  businessController.getSettings(req, res, next)
);
router.patch('/settings', authorize(PERMISSIONS['settings:write']), (req, res, next) =>
  businessController.updateSettings(req, res, next)
);

export default router;
