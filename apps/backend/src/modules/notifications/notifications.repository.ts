import { prisma } from '../../infrastructure/database/prisma';
import { Prisma } from '@prisma/client';

export class NotificationsRepository {
  async findMany(businessId: string, userId: string) {
    return prisma.notification.findMany({
      where: {
        businessId,
        OR: [{ userId }, { userId: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findById(businessId: string, id: string, userId: string) {
    return prisma.notification.findFirst({
      where: {
        id,
        businessId,
        OR: [{ userId }, { userId: null }],
      },
    });
  }

  async markAsRead(businessId: string, id: string, userId: string) {
    return prisma.notification.updateMany({
      where: {
        id,
        businessId,
        OR: [{ userId }, { userId: null }],
      },
      data: { isRead: true },
    });
  }

  async markAllAsRead(businessId: string, userId: string) {
    return prisma.notification.updateMany({
      where: {
        businessId,
        isRead: false,
        OR: [{ userId }, { userId: null }],
      },
      data: { isRead: true },
    });
  }

  async create(data: Prisma.NotificationCreateInput) {
    return prisma.notification.create({ data });
  }
}

export const notificationsRepository = new NotificationsRepository();
