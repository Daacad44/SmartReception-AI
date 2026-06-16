import { prisma } from '../../infrastructure/database/prisma';
import { Business, Prisma } from '@prisma/client';

export class BusinessRepository {
  async findById(businessId: string): Promise<Business | null> {
    return prisma.business.findFirst({
      where: { id: businessId, isActive: true },
    });
  }

  async update(businessId: string, data: Prisma.BusinessUpdateInput): Promise<Business> {
    return prisma.business.update({
      where: { id: businessId },
      data,
    });
  }

  async getSettings(businessId: string) {
    return prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        timezone: true,
        phone: true,
        email: true,
        website: true,
        address: true,
        logoUrl: true,
        subscription: {
          select: {
            plan: true,
            status: true,
            currentPeriodEnd: true,
          },
        },
        aiConfiguration: {
          select: {
            enableAutoReply: true,
            greetingMessage: true,
            fallbackMessage: true,
          },
        },
      },
    });
  }
}

export const businessRepository = new BusinessRepository();
