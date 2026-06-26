import { Router } from 'express';
import { superAdminController } from './super-admin.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { requireSuperAdmin } from '../../core/middleware/super-admin.middleware';

const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get('/stats', (req, res, next) => superAdminController.stats(req, res, next));

router.get('/businesses', (req, res, next) => superAdminController.businesses(req, res, next));
router.post('/businesses', (req, res, next) => superAdminController.createBusiness(req, res, next));
router.get('/businesses/:id', (req, res, next) => superAdminController.getBusiness(req, res, next));
router.patch('/businesses/:id', (req, res, next) => superAdminController.updateBusiness(req, res, next));
router.delete('/businesses/:id', (req, res, next) => superAdminController.deleteBusiness(req, res, next));
router.post('/businesses/:id/transfer-ownership', (req, res, next) =>
  superAdminController.transferOwnership(req, res, next)
);
router.patch('/businesses/:id/status', (req, res, next) => superAdminController.toggleBusiness(req, res, next));
router.post('/businesses/:id/impersonate', (req, res, next) =>
  superAdminController.impersonateBusiness(req, res, next)
);

router.get('/users', (req, res, next) => superAdminController.users(req, res, next));
router.post('/users', (req, res, next) => superAdminController.createUser(req, res, next));
router.patch('/users/:id', (req, res, next) => superAdminController.updateUser(req, res, next));
router.delete('/users/:id', (req, res, next) => superAdminController.deleteUser(req, res, next));
router.post('/users/:id/reset-password', (req, res, next) =>
  superAdminController.resetPassword(req, res, next)
);

router.get('/businesses/:businessId/business-profile', (req, res, next) =>
  superAdminController.getBusinessProfile(req, res, next)
);
router.patch('/businesses/:businessId/business-profile', (req, res, next) =>
  superAdminController.updateBusinessProfile(req, res, next)
);
router.get('/businesses/:businessId/knowledge-bases', (req, res, next) =>
  superAdminController.listKnowledgeBases(req, res, next)
);

router.get('/campaigns', (req, res, next) => superAdminController.listCampaigns(req, res, next));
router.get('/campaigns/stats', (req, res, next) => superAdminController.campaignStats(req, res, next));
router.post('/campaigns/:id/pause', (req, res, next) => superAdminController.pauseCampaign(req, res, next));

router.get('/employee-comms/broadcasts', (req, res, next) =>
  superAdminController.listEmployeeBroadcasts(req, res, next)
);
router.get('/employee-comms/stats', (req, res, next) =>
  superAdminController.employeeCommsStats(req, res, next)
);
router.post('/employee-comms/broadcasts/:id/pause', (req, res, next) =>
  superAdminController.pauseEmployeeBroadcast(req, res, next)
);

export default router;
