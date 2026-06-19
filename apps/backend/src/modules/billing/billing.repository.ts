import { prisma } from '../../infrastructure/database/prisma';
import { SubscriptionPlan } from '@prisma/client';

const PLAN_LIMITS: Record<
  SubscriptionPlan,
  { conversations: number; customers: number; teamMembers: number }
> = {
  FREE: { conversations: 100, customers: 50, teamMembers: 1 },
  STARTER: { conversations: 1000, customers: 500, teamMembers: 3 },
  BUSINESS: { conversations: 3000, customers: 1500, teamMembers: 5 },
  PROFESSIONAL: { conversations: 5000, customers: 2000, teamMembers: 10 },
  ENTERPRISE: { conversations: 50000, customers: 20000, teamMembers: 100 },
};

const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  FREE: 0,
  STARTER: 29,
  BUSINESS: 79,
  PROFESSIONAL: 99,
  ENTERPRISE: 299,
};

export class BillingRepository {
  async getSubscription(businessId: string) {
    return prisma.subscription.findUnique({
      where: { businessId },
    });
  }

  async getInvoices(businessId: string) {
    return prisma.invoice.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
  }

  async getUsageCounts(businessId: string) {
    const [conversations, customers, teamMembers] = await Promise.all([
      prisma.conversation.count({ where: { businessId } }),
      prisma.customer.count({ where: { businessId, isActive: true } }),
      prisma.businessMember.count({ where: { businessId, isActive: true } }),
    ]);

    return { conversations, customers, teamMembers };
  }

  getPlanLimits(plan: SubscriptionPlan) {
    return PLAN_LIMITS[plan];
  }

  getPlanPrice(plan: SubscriptionPlan) {
    return PLAN_PRICES[plan];
  }
}

export const billingRepository = new BillingRepository();
