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

const router = Router();

router.use('/auth', authRoutes);
router.use('/business', businessRoutes);
router.use('/customers', customersRoutes);
router.use('/conversations', conversationsRoutes);
router.use('/appointments', appointmentsRoutes);
router.use('/knowledge', knowledgeRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/billing', billingRoutes);
router.use('/team', teamRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/ai', aiRoutes);
router.use('/services', servicesRoutes);
router.use('/audit', auditRoutes);

export default router;
