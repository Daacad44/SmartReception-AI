import { Router } from 'express';
import { authenticate } from '../../core/middleware/auth.middleware';
import { requireBusiness } from '../../core/middleware/authorize.middleware';
import { requireSuperAdmin } from '../../core/middleware/super-admin.middleware';
import {
  subscriptionAdminController,
  subscriptionController,
} from './subscription.controller';

const adminRouter = Router();
adminRouter.use(authenticate, requireSuperAdmin);

adminRouter.get('/plans', (req, res, next) => subscriptionAdminController.listPlans(req, res, next));
adminRouter.get('/', (req, res, next) => subscriptionAdminController.list(req, res, next));
adminRouter.post('/calculate-preview', (req, res, next) =>
  subscriptionAdminController.calculatePreview(req, res, next)
);
adminRouter.get('/:businessId', (req, res, next) => subscriptionAdminController.get(req, res, next));
adminRouter.post('/:businessId/assign', (req, res, next) =>
  subscriptionAdminController.assign(req, res, next)
);
adminRouter.post('/:businessId/extend', (req, res, next) =>
  subscriptionAdminController.extend(req, res, next)
);
adminRouter.post('/:businessId/shorten', (req, res, next) =>
  subscriptionAdminController.shorten(req, res, next)
);
adminRouter.post('/:businessId/pause', (req, res, next) =>
  subscriptionAdminController.pause(req, res, next)
);
adminRouter.post('/:businessId/resume', (req, res, next) =>
  subscriptionAdminController.resume(req, res, next)
);
adminRouter.post('/:businessId/suspend', (req, res, next) =>
  subscriptionAdminController.suspend(req, res, next)
);
adminRouter.post('/:businessId/reactivate', (req, res, next) =>
  subscriptionAdminController.reactivate(req, res, next)
);
adminRouter.post('/:businessId/cancel', (req, res, next) =>
  subscriptionAdminController.cancel(req, res, next)
);
adminRouter.post('/:businessId/unlock', (req, res, next) =>
  subscriptionAdminController.unlock(req, res, next)
);
adminRouter.post('/:businessId/upgrade', (req, res, next) =>
  subscriptionAdminController.upgrade(req, res, next)
);
adminRouter.post('/:businessId/downgrade', (req, res, next) =>
  subscriptionAdminController.downgrade(req, res, next)
);
adminRouter.post('/:businessId/lock', (req, res, next) =>
  subscriptionAdminController.lock(req, res, next)
);
adminRouter.post('/:businessId/notes', (req, res, next) =>
  subscriptionAdminController.addNote(req, res, next)
);

const tenantRouter = Router();
tenantRouter.use(authenticate, requireBusiness);
tenantRouter.get('/status', (req, res, next) => subscriptionController.status(req, res, next));

export { adminRouter as subscriptionAdminRoutes, tenantRouter as subscriptionRoutes };
