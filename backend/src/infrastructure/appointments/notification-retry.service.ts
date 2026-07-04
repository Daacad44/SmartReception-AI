import { appointmentNotificationRepository } from './appointment-notification.repository';
import {
  dispatchAppointmentNotification,
  type DispatchNotificationParams,
} from './appointment-notification-engine.service';
import { prisma } from '../database/prisma';
import { logger } from '../../core/logger';

const RETRY_BATCH = 20;
const RETRY_DELAY_MS = 5 * 60 * 1000;

export async function retryFailedAppointmentNotifications(): Promise<void> {
  const pending = await appointmentNotificationRepository.listFailedForRetry(RETRY_BATCH);

  for (const record of pending) {
    if (!record.templateKey || !record.recipient) continue;
    if (record.failedAt && Date.now() - record.failedAt.getTime() < RETRY_DELAY_MS) continue;

    try {
      await dispatchAppointmentNotification({
        appointmentId: record.appointmentId,
        businessId: record.businessId,
        notificationType: record.notificationType,
        templateKey: record.templateKey as DispatchNotificationParams['templateKey'],
        channels: [record.channel],
      });
    } catch (error) {
      logger.warn('Notification retry failed', {
        notificationId: record.id,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  const hardFailed = await appointmentNotificationRepository.listHardFailed(5);
  if (hardFailed.length > 0) {
    logger.error('Appointment notifications permanently failed', {
      count: hardFailed.length,
      ids: hardFailed.map((r) => r.id),
    });
  }
}

export async function seedBusinessAppointmentTemplates(businessId: string) {
  const { appointmentTemplateService } = await import('./appointment-template.service');
  await appointmentTemplateService.seedDefaultTemplates(businessId);
}

export async function ensureBusinessTemplates(businessId: string) {
  const count = await prisma.appointmentMessageTemplate.count({ where: { businessId } });
  if (count === 0) {
    await seedBusinessAppointmentTemplates(businessId);
  }
}
