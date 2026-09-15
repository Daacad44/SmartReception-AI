import { NotificationType, Prisma } from '@prisma/client';
import { notificationsRepository } from '../../modules/notifications/notifications.repository';
import { logger } from '../../core/logger';
import { formatCustomerAlertIdentity } from './customer-alert-identity';

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

export async function notifyHumanHandoff(params: {
  businessId: string;
  conversationId: string;
  customerName: string;
  customerPhone?: string | null;
  title: string;
  reason?: string;
  urgent?: boolean;
}): Promise<void> {
  const existing = await notificationsRepository.findUnreadEscalationForConversation(
    params.businessId,
    params.conversationId
  );
  if (existing) return;

  const identity = formatCustomerAlertIdentity(params.customerName, params.customerPhone);

  await createNotification({
    businessId: params.businessId,
    type: 'AI_ESCALATION',
    title: params.title,
    message: identity,
    data: {
      conversationId: params.conversationId,
      customerName: params.customerName,
      customerPhone: params.customerPhone ?? null,
      reason: params.reason,
      urgent: params.urgent ?? true,
      sound: true,
      desktop: true,
    },
  });
}

export async function notifyConversationAssignment(params: {
  businessId: string;
  userId: string;
  conversationId: string;
  customerName: string;
  customerPhone?: string | null;
  title: string;
  message: string;
}): Promise<void> {
  await createNotification({
    businessId: params.businessId,
    userId: params.userId,
    type: 'TEAM',
    title: params.title,
    message: params.message,
    data: {
      conversationId: params.conversationId,
      customerName: params.customerName,
      customerPhone: params.customerPhone ?? null,
      sound: true,
      desktop: true,
    },
  });
}
