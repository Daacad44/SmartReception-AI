import { Router } from 'express';
import { servicesController } from './services.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  servicesController.list(req, res, next)
);
router.post('/', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  servicesController.create(req, res, next)
);
router.get('/:id', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  servicesController.get(req, res, next)
);
router.patch('/:id', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  servicesController.update(req, res, next)
);
router.delete('/:id', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  servicesController.delete(req, res, next)
);

export default router;
