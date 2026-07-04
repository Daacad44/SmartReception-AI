import { Router } from 'express';
import { messageTemplatesController } from './message-templates.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/', authorize(PERMISSIONS['campaigns:read']), (req, res, next) =>
  messageTemplatesController.list(req, res, next)
);
router.post('/', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  messageTemplatesController.create(req, res, next)
);
router.get('/:id', authorize(PERMISSIONS['campaigns:read']), (req, res, next) =>
  messageTemplatesController.get(req, res, next)
);
router.patch('/:id', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  messageTemplatesController.update(req, res, next)
);
router.delete('/:id', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  messageTemplatesController.delete(req, res, next)
);

export default router;
