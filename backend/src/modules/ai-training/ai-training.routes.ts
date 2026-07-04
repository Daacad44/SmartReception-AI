import { Router } from 'express';
import { aiTrainingController } from './ai-training.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/', authorize(PERMISSIONS['knowledge:read']), (req, res, next) =>
  aiTrainingController.overview(req, res, next)
);
router.post('/reindex', authorize(PERMISSIONS['knowledge:write']), (req, res, next) =>
  aiTrainingController.reindex(req, res, next)
);
router.post('/reset-memory', authorize(PERMISSIONS['knowledge:write']), (req, res, next) =>
  aiTrainingController.resetMemory(req, res, next)
);

export default router;
