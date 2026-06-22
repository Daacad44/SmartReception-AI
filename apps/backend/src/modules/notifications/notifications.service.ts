import { NotificationType } from '@prisma/client';
import { notificationsRepository } from './notifications.repository';
import { NotFoundError } from '../../core/errors';

const TYPE_MAP: Record<NotificationType, 'info' | 'success' | 'warning' | 'error'> = {
  MESSAGE: 'info',
  APPOINTMENT: 'success',
  TEAM: 'info',
  SYSTEM: 'warning',
  BILLING: 'error',
  REMINDER: 'info',
  MISSED_APPOINTMENT: 'warning',
  NEW_CUSTOMER: 'success',
  AI_ESCALATION: 'warning',
  APPOINTMENT_APPROVED: 'success',
  APPOINTMENT_CANCELLED: 'warning',
  CAMPAIGN_DELIVERED: 'success',
  CAMPAIGN_FAILED: 'error',
};

function mapNotification(notification: {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: Date;
  data?: unknown;
}) {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: TYPE_MAP[notification.type] || 'info',
    read: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
    data: notification.data ?? null,
  };
}

export class NotificationsService {
  async list(businessId: string, userId: string) {
    const notifications = await notificationsRepository.findMany(businessId, userId);
    return notifications.map(mapNotification);
  }

  async markAsRead(businessId: string, userId: string, id: string) {
    const notification = await notificationsRepository.findById(businessId, id, userId);
    if (!notification) {
      throw new NotFoundError('Notification not found');
    }

    await notificationsRepository.markAsRead(businessId, id, userId);
    return mapNotification({ ...notification, isRead: true });
  }

  async markAllAsRead(businessId: string, userId: string) {
    const result = await notificationsRepository.markAllAsRead(businessId, userId);
    return { updated: result.count };
  }
}

export const notificationsService = new NotificationsService();
