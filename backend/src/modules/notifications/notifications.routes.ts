import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { requireBusiness } from '../../core/middleware/authorize.middleware';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/', (req, res, next) => notificationsController.list(req, res, next));
router.patch('/read-all', (req, res, next) =>
  notificationsController.markAllAsRead(req, res, next)
);
router.patch('/:id/read', (req, res, next) =>
  notificationsController.markAsRead(req, res, next)
);

export default router;
