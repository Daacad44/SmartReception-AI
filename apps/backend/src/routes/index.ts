import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import businessRoutes from '../modules/business/business.routes';
import customersRoutes from '../modules/customers/customers.routes';
import conversationsRoutes from '../modules/conversations/conversations.routes';
import appointmentsRoutes from '../modules/appointments/appointments.routes';
import knowledgeRoutes from '../modules/knowledge/knowledge.routes';
import analyticsRoutes from '../modules/analytics/analytics.routes';
import dashboardRoutes from '../modules/dashboard/dashboard.routes';
import notificationsRoutes from '../modules/notifications/notifications.routes';
import billingRoutes from '../modules/billing/billing.routes';
import teamRoutes from '../modules/team/team.routes';
import whatsappRoutes from '../modules/whatsapp/whatsapp.routes';
import aiRoutes from '../modules/ai/ai.routes';
import servicesRoutes from '../modules/services/services.routes';
import auditRoutes from '../modules/audit/audit.routes';
import webhooksRoutes from '../modules/webhooks/webhooks.routes';
import twoFactorRoutes from '../modules/two-factor/two-factor.routes';
import superAdminRoutes from '../modules/super-admin/super-admin.routes';
import segmentsRoutes from '../modules/segments/segments.routes';
import campaignsRoutes from '../modules/campaigns/campaigns.routes';
import customerImportRoutes from '../modules/customer-import/customer-import.routes';
import messageTemplatesRoutes from '../modules/message-templates/message-templates.routes';
import employeeCommsRoutes from '../modules/employee-comms/employee-comms.routes';
import businessProfileRoutes from '../modules/business-profile/business-profile.routes';
import onboardingRoutes from '../modules/onboarding/onboarding.routes';
import governanceRoutes from '../modules/governance/governance.routes';
import aiTrainingRoutes from '../modules/ai-training/ai-training.routes';
import aiTrainingMgmtRoutes from '../modules/ai-training-mgmt/ai-training-mgmt.routes';
import aiTrainingAdminRoutes from '../modules/ai-training-mgmt/ai-training-admin.routes';
import trainerPortalRoutes from '../modules/ai-training-mgmt/trainer/trainer.routes';
import {
  subscriptionAdminRoutes,
  subscriptionRoutes,
} from '../modules/subscription/subscription.routes';
import { requireValidLicense } from '../core/middleware/subscription.middleware';
import { authenticate } from '../core/middleware/auth.middleware';
import { requireBusiness } from '../core/middleware/authorize.middleware';

const router = Router();

router.use('/auth', authRoutes);
router.use('/trainer-portal', trainerPortalRoutes);
router.use('/webhooks', webhooksRoutes);
router.use('/super-admin', superAdminRoutes);
router.use('/super-admin/ai-training', aiTrainingAdminRoutes);
router.use('/super-admin/subscriptions', subscriptionAdminRoutes);
router.use('/subscription', subscriptionRoutes);

// Onboarding: auth only — users may not have businessId yet (pre- and mid-onboarding)
router.use('/onboarding', authenticate, onboardingRoutes);

const licensed = Router();
licensed.use(authenticate, requireBusiness, requireValidLicense());

licensed.use('/business', businessRoutes);
licensed.use('/customers', customersRoutes);
licensed.use('/conversations', conversationsRoutes);
licensed.use('/appointments', appointmentsRoutes);
licensed.use('/knowledge', knowledgeRoutes);
licensed.use('/analytics', analyticsRoutes);
licensed.use('/dashboard', dashboardRoutes);
licensed.use('/notifications', notificationsRoutes);
licensed.use('/team', teamRoutes);
licensed.use('/whatsapp', whatsappRoutes);
licensed.use('/ai', aiRoutes);
licensed.use('/services', servicesRoutes);
licensed.use('/audit', auditRoutes);
licensed.use('/2fa', twoFactorRoutes);
licensed.use('/segments', segmentsRoutes);
licensed.use('/campaigns', campaignsRoutes);
licensed.use('/customer-import', customerImportRoutes);
licensed.use('/message-templates', messageTemplatesRoutes);
licensed.use('/employee-comms', employeeCommsRoutes);
licensed.use('/business-profile', businessProfileRoutes);
licensed.use('/governance', governanceRoutes);
licensed.use('/ai-training', aiTrainingRoutes);
licensed.use('/ai-training-mgmt', aiTrainingMgmtRoutes);

router.use('/billing', billingRoutes);
router.use(licensed);

export default router;
