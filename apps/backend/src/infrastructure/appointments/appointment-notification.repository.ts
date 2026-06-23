import { prisma } from '../database/prisma';
import type {
  AppointmentNotificationChannel,
  AppointmentNotificationStatus,
  AppointmentNotificationType,
} from '@prisma/client';

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
    channel: AppointmentNotificationChannel
  ) {
    return prisma.appointmentNotification.findUnique({
      where: {
        appointmentId_notificationType_channel: {
          appointmentId,
          notificationType,
          channel,
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
    scheduledAt?: Date;
  }) {
    return prisma.appointmentNotification.upsert({
      where: {
        appointmentId_notificationType_channel: {
          appointmentId: params.appointmentId,
          notificationType: params.notificationType,
          channel: params.channel,
        },
      },
      create: {
        appointmentId: params.appointmentId,
        businessId: params.businessId,
        customerId: params.customerId,
        notificationType: params.notificationType,
        channel: params.channel,
        scheduledAt: params.scheduledAt,
        status: 'PENDING',
      },
      update: {
        scheduledAt: params.scheduledAt,
        status: 'PENDING',
        errorMessage: null,
      },
    });
  }

  async markSent(id: string) {
    return prisma.appointmentNotification.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), errorMessage: null },
    });
  }

  async markFailed(id: string, errorMessage: string) {
    return prisma.appointmentNotification.update({
      where: { id },
      data: { status: 'FAILED', errorMessage: errorMessage.slice(0, 500) },
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
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'asc' },
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
