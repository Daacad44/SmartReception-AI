import { Router } from 'express';
import multer from 'multer';
import { employeeCommsController } from './employee-comms.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { requirePlatformFeature } from '../../core/middleware/platform-feature.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authenticate, requireBusiness, requirePlatformFeature('employee-comms'));

// Employees
router.get('/employees', authorize(PERMISSIONS['employees:read']), (req, res, next) =>
  employeeCommsController.listEmployees(req, res, next)
);
router.post('/employees', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.createEmployee(req, res, next)
);
router.post('/employees/export', authorize(PERMISSIONS['employees:read']), (req, res, next) =>
  employeeCommsController.exportEmployees(req, res, next)
);
router.post('/employees/bulk-delete', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.bulkDeleteEmployees(req, res, next)
);
router.post('/employees/bulk-status', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.bulkUpdateEmployeeStatus(req, res, next)
);
router.post('/employees/bulk-assign-groups', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.bulkAssignGroups(req, res, next)
);
router.post('/employees/bulk-remove-groups', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.bulkRemoveGroups(req, res, next)
);
router.post('/employees/move-group', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.moveEmployeesGroup(req, res, next)
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

// Import
router.get('/import/jobs', authorize(PERMISSIONS['employees:read']), (req, res, next) =>
  employeeCommsController.listImportJobs(req, res, next)
);
router.get('/import/jobs/:id', authorize(PERMISSIONS['employees:read']), (req, res, next) =>
  employeeCommsController.getImportJob(req, res, next)
);
router.post(
  '/import/upload',
  authorize(PERMISSIONS['employees:write']),
  upload.single('file'),
  (req, res, next) => employeeCommsController.uploadImport(req, res, next)
);
router.post('/import/paste', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.pasteImport(req, res, next)
);

// Groups
router.get('/groups', authorize(PERMISSIONS['employees:read']), (req, res, next) =>
  employeeCommsController.listGroups(req, res, next)
);
router.post('/groups', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.createGroup(req, res, next)
);
router.post('/groups/merge', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.mergeGroups(req, res, next)
);
router.get('/groups/:id', authorize(PERMISSIONS['employees:read']), (req, res, next) =>
  employeeCommsController.getGroup(req, res, next)
);
router.patch('/groups/:id', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.updateGroup(req, res, next)
);
router.delete('/groups/:id', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.deleteGroup(req, res, next)
);
router.post('/groups/:id/archive', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.archiveGroup(req, res, next)
);
router.post('/groups/:id/duplicate', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.duplicateGroup(req, res, next)
);
router.post('/groups/:id/members', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.addGroupMembers(req, res, next)
);
router.post('/groups/:id/members/remove', authorize(PERMISSIONS['employees:write']), (req, res, next) =>
  employeeCommsController.removeGroupMembers(req, res, next)
);
router.get('/groups/:id/analytics', authorize(PERMISSIONS['employee-comms:read']), (req, res, next) =>
  employeeCommsController.groupAnalytics(req, res, next)
);
router.get('/groups/:id/inbox', authorize(PERMISSIONS['employee-comms:read']), (req, res, next) =>
  employeeCommsController.groupInbox(req, res, next)
);
router.get('/groups/:id/export', authorize(PERMISSIONS['employees:read']), (req, res, next) =>
  employeeCommsController.exportGroup(req, res, next)
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
router.post('/broadcasts/preview-recipients', authorize(PERMISSIONS['employee-comms:read']), (req, res, next) =>
  employeeCommsController.previewRecipients(req, res, next)
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
