import { Router } from 'express';
import { authenticate } from '../../core/middleware/auth.middleware';
import { requireSuperAdmin } from '../../core/middleware/super-admin.middleware';
import { requireBusiness } from '../../core/middleware/authorize.middleware';
import { financialIntelligenceController } from './financial-intelligence.controller';

const adminRouter = Router();
adminRouter.use(authenticate, requireSuperAdmin);

adminRouter.get('/dashboard', (req, res, next) =>
  financialIntelligenceController.platformDashboard(req, res, next)
);
adminRouter.get('/businesses', (req, res, next) =>
  financialIntelligenceController.listBusinesses(req, res, next)
);
adminRouter.get('/businesses/:businessId', (req, res, next) =>
  financialIntelligenceController.getBusiness(req, res, next)
);
adminRouter.post('/businesses/:businessId/refresh', (req, res, next) =>
  financialIntelligenceController.refreshBusiness(req, res, next)
);
adminRouter.post('/refresh-all', (req, res, next) =>
  financialIntelligenceController.refreshAll(req, res, next)
);
adminRouter.get('/config', (req, res, next) =>
  financialIntelligenceController.getConfig(req, res, next)
);
adminRouter.put('/config', (req, res, next) =>
  financialIntelligenceController.updateConfig(req, res, next)
);
adminRouter.get('/alerts', (req, res, next) =>
  financialIntelligenceController.listAlerts(req, res, next)
);
adminRouter.post('/alerts/:alertId/acknowledge', (req, res, next) =>
  financialIntelligenceController.acknowledgeAlert(req, res, next)
);
adminRouter.post('/simulator', (req, res, next) =>
  financialIntelligenceController.simulate(req, res, next)
);
adminRouter.post('/simulator/break-even', (req, res, next) =>
  financialIntelligenceController.breakEven(req, res, next)
);
adminRouter.get('/forecast', (req, res, next) =>
  financialIntelligenceController.forecast(req, res, next)
);
adminRouter.get('/audit-logs', (req, res, next) =>
  financialIntelligenceController.auditLogs(req, res, next)
);

const tenantRouter = Router();
tenantRouter.use(authenticate, requireBusiness);
tenantRouter.get('/summary', (req, res, next) =>
  financialIntelligenceController.tenantSummary(req, res, next)
);

export { adminRouter as financialIntelligenceAdminRoutes, tenantRouter as financialIntelligenceRoutes };
