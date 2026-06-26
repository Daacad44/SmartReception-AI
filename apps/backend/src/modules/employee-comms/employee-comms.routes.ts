import { Router } from 'express';
import { employeeCommsController } from './employee-comms.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

// Employees
router.get('/employees', authorize(PERMISSIONS['employees:read']), (req, res, next) =>
  employeeCommsController.listEmployees(req, res, next)
);
router.post('/employees', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.createEmployee(req, res, next)
);
router.get('/employees/:id', authorize(PERMISSIONS['employees:read']), (req, res, next) =>
  employeeCommsController.getEmployee(req, res, next)
);
router.patch('/employees/:id', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.updateEmployee(req, res, next)
);
router.delete('/employees/:id', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.deleteEmployee(req, res, next)
);

// Groups
router.get('/groups', authorize(PERMISSIONS['employees:read']), (req, res, next) =>
  employeeCommsController.listGroups(req, res, next)
);
router.post('/groups', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.createGroup(req, res, next)
);
router.patch('/groups/:id', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.updateGroup(req, res, next)
);
router.delete('/groups/:id', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.deleteGroup(req, res, next)
);

// Broadcasts
router.get('/broadcasts', authorize(PERMISSIONS['employee-comms:read']), (req, res, next) =>
  employeeCommsController.listBroadcasts(req, res, next)
);
router.get('/broadcasts/analytics', authorize(PERMISSIONS['employee-comms:read']), (req, res, next) =>
  employeeCommsController.broadcastAnalytics(req, res, next)
);
router.get('/broadcasts/deliveries', authorize(PERMISSIONS['employee-comms:read']), (req, res, next) =>
  employeeCommsController.deliveries(req, res, next)
);
router.post('/broadcasts/generate-ai', authorize(PERMISSIONS['employee-comms:write']), (req, res, next) =>
  employeeCommsController.generateAi(req, res, next)
);
router.post('/broadcasts', authorize(PERMISSIONS['employee-comms:write']), (req, res, next) =>
  employeeCommsController.createBroadcast(req, res, next)
);
router.get('/broadcasts/:id', authorize(PERMISSIONS['employee-comms:read']), (req, res, next) =>
  employeeCommsController.getBroadcast(req, res, next)
);
router.post('/broadcasts/:id/send', authorize(PERMISSIONS['employee-comms:write']), (req, res, next) =>
  employeeCommsController.sendBroadcast(req, res, next)
);
router.post('/broadcasts/:id/pause', authorize(PERMISSIONS['employee-comms:write']), (req, res, next) =>
  employeeCommsController.pauseBroadcast(req, res, next)
);
router.post('/broadcasts/:id/resume', authorize(PERMISSIONS['employee-comms:write']), (req, res, next) =>
  employeeCommsController.resumeBroadcast(req, res, next)
);
router.post('/broadcasts/:id/cancel', authorize(PERMISSIONS['employee-comms:write']), (req, res, next) =>
  employeeCommsController.cancelBroadcast(req, res, next)
);

// Templates
router.get('/templates', authorize(PERMISSIONS['employee-comms:read']), (req, res, next) =>
  employeeCommsController.listTemplates(req, res, next)
);
router.post('/templates', authorize(PERMISSIONS['employee-comms:write']), (req, res, next) =>
  employeeCommsController.createTemplate(req, res, next)
);
router.patch('/templates/:id', authorize(PERMISSIONS['employee-comms:write']), (req, res, next) =>
  employeeCommsController.updateTemplate(req, res, next)
);
router.delete('/templates/:id', authorize(PERMISSIONS['employee-comms:write']), (req, res, next) =>
  employeeCommsController.deleteTemplate(req, res, next)
);

// Inbox
router.get('/inbox', authorize(PERMISSIONS['employee-comms:read']), (req, res, next) =>
  employeeCommsController.listInbox(req, res, next)
);
router.get('/inbox/:id', authorize(PERMISSIONS['employee-comms:read']), (req, res, next) =>
  employeeCommsController.getInboxConversation(req, res, next)
);
router.post('/inbox/:id/reply', authorize(PERMISSIONS['employee-comms:write']), (req, res, next) =>
  employeeCommsController.replyInbox(req, res, next)
);
router.post('/inbox/:id/archive', authorize(PERMISSIONS['employee-comms:write']), (req, res, next) =>
  employeeCommsController.archiveInbox(req, res, next)
);

export default router;
