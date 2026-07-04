import type {
  AppointmentNotificationChannel,
  AppointmentNotificationStatus,
  AppointmentNotificationType,
} from '@prisma/client';
import { prisma } from '../database/prisma';

export class AppointmentNotificationRepository {
  async findByAppointment(appointmentId: string, businessId: string) {
    return prisma.appointmentNotification.findMany({
      where: { appointmentId, businessId },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findSent(
    appointmentId: string,
    notificationType: AppointmentNotificationType,
    channel: AppointmentNotificationChannel,
    recipient: string
  ) {
    return prisma.appointmentNotification.findUnique({
      where: {
        appointmentId_notificationType_channel_recipient: {
          appointmentId,
          notificationType,
          channel,
          recipient,
        },
      },
    });
  }

  async upsertPending(params: {
    appointmentId: string;
    businessId: string;
    customerId: string;
    notificationType: AppointmentNotificationType;
    channel: AppointmentNotificationChannel;
    recipient: string;
    templateKey?: string;
    scheduledAt?: Date;
  }) {
    return prisma.appointmentNotification.upsert({
      where: {
        appointmentId_notificationType_channel_recipient: {
          appointmentId: params.appointmentId,
          notificationType: params.notificationType,
          channel: params.channel,
          recipient: params.recipient,
        },
      },
      create: {
        appointmentId: params.appointmentId,
        businessId: params.businessId,
        customerId: params.customerId,
        notificationType: params.notificationType,
        channel: params.channel,
        recipient: params.recipient,
        templateKey: params.templateKey,
        scheduledAt: params.scheduledAt,
        status: 'PENDING',
      },
      update: {
        scheduledAt: params.scheduledAt,
        templateKey: params.templateKey,
        status: 'PENDING',
        errorMessage: null,
        failedAt: null,
      },
    });
  }

  async markSent(id: string, externalMessageId?: string) {
    return prisma.appointmentNotification.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        errorMessage: null,
        externalMessageId,
      },
    });
  }

  async markFailed(id: string, errorMessage: string) {
    const record = await prisma.appointmentNotification.findUnique({ where: { id } });
    if (!record) return null;

    const retryCount = record.retryCount + 1;
    return prisma.appointmentNotification.update({
      where: { id },
      data: {
        status: retryCount >= record.maxRetries ? 'FAILED' : 'PENDING',
        errorMessage: errorMessage.slice(0, 500),
        failedAt: new Date(),
        retryCount,
      },
    });
  }

  async markSkipped(id: string, reason: string) {
    return prisma.appointmentNotification.update({
      where: { id },
      data: { status: 'SKIPPED', errorMessage: reason.slice(0, 500) },
    });
  }

  async listFailedForRetry(limit = 20) {
    return prisma.appointmentNotification.findMany({
      where: {
        status: 'PENDING',
        retryCount: { gt: 0 },
        failedAt: { not: null },
      },
      orderBy: { failedAt: 'asc' },
      take: limit,
    });
  }

  async listHardFailed(limit = 20) {
    return prisma.appointmentNotification.findMany({
      where: { status: 'FAILED' },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });
  }
}

export const appointmentNotificationRepository = new AppointmentNotificationRepository();

export type {
  AppointmentNotificationChannel,
  AppointmentNotificationStatus,
  AppointmentNotificationType,
};
