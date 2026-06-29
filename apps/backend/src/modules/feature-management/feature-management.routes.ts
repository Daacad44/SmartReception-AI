import { Router } from 'express';
import { featureManagementController } from './feature-management.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { requireSuperAdmin } from '../../core/middleware/super-admin.middleware';

const router = Router();

router.get('/public-map', authenticate, (req, res, next) =>
  featureManagementController.publicMap(req, res, next)
);

router.use(authenticate, requireSuperAdmin);

router.get('/stats', (req, res, next) => featureManagementController.stats(req, res, next));
router.get('/features', (req, res, next) => featureManagementController.list(req, res, next));
router.get('/features/:id', (req, res, next) => featureManagementController.get(req, res, next));
router.get('/audit-logs', (req, res, next) => featureManagementController.auditLogs(req, res, next));

router.post('/verify/request', (req, res, next) =>
  featureManagementController.requestActivation(req, res, next)
);
router.post('/verify/confirm', (req, res, next) =>
  featureManagementController.verifyActivation(req, res, next)
);
router.post('/verify/:requestId/cancel', (req, res, next) =>
  featureManagementController.cancelVerification(req, res, next)
);

export default router;
