import { Router } from 'express';
import { aiController } from './ai.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/config', authorize(PERMISSIONS['ai:configure']), (req, res, next) =>
  aiController.getConfig(req, res, next)
);
router.put('/config', authorize(PERMISSIONS['ai:configure']), (req, res, next) =>
  aiController.updateConfig(req, res, next)
);

export default router;
