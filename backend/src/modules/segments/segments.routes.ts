import { Router } from 'express';
import { segmentsController } from './segments.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/', authorize(PERMISSIONS['campaigns:read']), (req, res, next) =>
  segmentsController.list(req, res, next)
);
router.post('/', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  segmentsController.create(req, res, next)
);
router.get('/:id', authorize(PERMISSIONS['campaigns:read']), (req, res, next) =>
  segmentsController.get(req, res, next)
);
router.patch('/:id', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  segmentsController.update(req, res, next)
);
router.delete('/:id', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  segmentsController.delete(req, res, next)
);
router.post('/:id/members', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  segmentsController.addMembers(req, res, next)
);

export default router;
