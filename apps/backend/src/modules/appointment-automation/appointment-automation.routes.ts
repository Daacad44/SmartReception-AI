import { Router } from 'express';
import { appointmentAutomationController } from './appointment-automation.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/templates', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  appointmentAutomationController.listTemplates(req, res, next)
);
router.get('/workflows', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  appointmentAutomationController.listWorkflows(req, res, next)
);
router.get('/workflows/:workflowId', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  appointmentAutomationController.getWorkflow(req, res, next)
);
router.post('/workflows/from-template', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  appointmentAutomationController.createFromTemplate(req, res, next)
);
router.patch('/workflows/:workflowId', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  appointmentAutomationController.updateWorkflow(req, res, next)
);
router.post('/workflows/:workflowId/duplicate', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  appointmentAutomationController.duplicateWorkflow(req, res, next)
);
router.get('/settings', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  appointmentAutomationController.getSettings(req, res, next)
);
router.patch('/settings', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  appointmentAutomationController.updateSettings(req, res, next)
);
router.get('/reminders', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  appointmentAutomationController.listReminders(req, res, next)
);
router.put('/reminders', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  appointmentAutomationController.updateReminders(req, res, next)
);
router.get('/analytics', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  appointmentAutomationController.analytics(req, res, next)
);
router.get('/appointments/:appointmentId/timeline', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  appointmentAutomationController.getTimeline(req, res, next)
);
router.get('/appointments/:appointmentId/executions', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  appointmentAutomationController.getExecutions(req, res, next)
);
router.post('/appointments/:appointmentId/transition', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  appointmentAutomationController.transitionStage(req, res, next)
);
router.get('/appointments/:appointmentId/ai-insights', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  appointmentAutomationController.aiInsights(req, res, next)
);

export default router;
