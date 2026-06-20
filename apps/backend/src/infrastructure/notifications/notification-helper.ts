import { NotificationType, Prisma } from '@prisma/client';
import { notificationsRepository } from '../../modules/notifications/notifications.repository';
import { logger } from '../../core/logger';

interface CreateNotificationParams {
  businessId: string;
  userId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    await notificationsRepository.create({
      business: { connect: { id: params.businessId } },
      ...(params.userId ? { user: { connect: { id: params.userId } } } : {}),
      type: params.type,
      title: params.title,
      message: params.message,
      data: (params.data ?? undefined) as Prisma.InputJsonValue | undefined,
    });
  } catch (error) {
    logger.error('Failed to create notification:', error);
  }
}

export async function notifyNewMessage(
  businessId: string,
  customerName: string,
  conversationId: string
): Promise<void> {
  await createNotification({
    businessId,
    type: 'MESSAGE',
    title: 'New message',
    message: `${customerName} sent a new message`,
    data: { conversationId },
  });
}

export async function notifyAppointment(
  businessId: string,
  title: string,
  message: string,
  appointmentId: string,
  userId?: string
): Promise<void> {
  await createNotification({
    businessId,
    userId,
    type: 'APPOINTMENT',
    title,
    message,
    data: { appointmentId },
  });
}

export async function notifyTeam(
  businessId: string,
  userId: string,
  title: string,
  message: string
): Promise<void> {
  await createNotification({
    businessId,
    userId,
    type: 'TEAM',
    title,
    message,
  });
}

export async function notifyBilling(
  businessId: string,
  title: string,
  message: string
): Promise<void> {
  await createNotification({
    businessId,
    type: 'BILLING',
    title,
    message,
  });
}

export async function notifyKnowledge(
  businessId: string,
  title: string,
  message: string,
  documentId?: string
): Promise<void> {
  await createNotification({
    businessId,
    type: 'SYSTEM',
    title,
    message,
    data: documentId ? { documentId } : undefined,
  });
}
