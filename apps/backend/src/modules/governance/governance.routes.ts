import { Router } from 'express';
import { governanceController } from './governance.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/capabilities', authorize(PERMISSIONS['knowledge:read']), (req, res, next) =>
  governanceController.capabilities(req, res, next)
);
router.get('/requests', authorize(PERMISSIONS['knowledge:read']), (req, res, next) =>
  governanceController.listRequests(req, res, next)
);
router.get('/requests/:id', authorize(PERMISSIONS['knowledge:read']), (req, res, next) =>
  governanceController.getRequest(req, res, next)
);
router.post('/requests/:id/activate', authorize(PERMISSIONS['knowledge:write']), (req, res, next) =>
  governanceController.activate(req, res, next)
);

export default router;
