import { Router } from 'express';
import { campaignsController } from './campaigns.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/', authorize(PERMISSIONS['campaigns:read']), (req, res, next) =>
  campaignsController.list(req, res, next)
);
router.post('/', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignsController.create(req, res, next)
);
router.get('/:id', authorize(PERMISSIONS['campaigns:read']), (req, res, next) =>
  campaignsController.get(req, res, next)
);
router.patch('/:id', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignsController.update(req, res, next)
);
router.post('/:id/cancel', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignsController.cancel(req, res, next)
);
router.post('/:id/send', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignsController.sendNow(req, res, next)
);

export default router;
