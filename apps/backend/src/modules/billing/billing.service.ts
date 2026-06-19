import { billingRepository } from './billing.repository';
import { SubscriptionPlan } from '@prisma/client';
import { ChangePlanInput } from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';
import { ForbiddenError } from '../../core/errors';

const STATUS_MAP: Record<string, string> = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

const INVOICE_STATUS_MAP: Record<string, string> = {
  DRAFT: 'draft',
  OPEN: 'open',
  PAID: 'paid',
  VOID: 'void',
  UNCOLLECTIBLE: 'uncollectible',
};

export class BillingService {
  async getBillingOverview(businessId: string) {
    const [subscription, invoices, usageCounts] = await Promise.all([
      billingRepository.getSubscription(businessId),
      billingRepository.getInvoices(businessId),
      billingRepository.getUsageCounts(businessId),
    ]);

    const plan = subscription?.plan ?? SubscriptionPlan.FREE;
    const limits = billingRepository.getPlanLimits(plan);
    const price = billingRepository.getPlanPrice(plan);

    return {
      plan,
      status: STATUS_MAP[subscription?.status ?? 'TRIALING'] || 'trialing',
      price,
      billingCycle: 'monthly',
      nextBillingDate: subscription?.currentPeriodEnd?.toISOString().split('T')[0] ?? null,
      usage: {
        conversations: { used: usageCounts.conversations, limit: limits.conversations },
        customers: { used: usageCounts.customers, limit: limits.customers },
        teamMembers: { used: usageCounts.teamMembers, limit: limits.teamMembers },
      },
      invoices: invoices.map((inv) => ({
        id: inv.id,
        date: inv.createdAt.toISOString().split('T')[0],
        amount: Number(inv.amount),
        status: INVOICE_STATUS_MAP[inv.status] || inv.status.toLowerCase(),
      })),
    };
  }

  async changePlan(businessId: string, input: ChangePlanInput, userId: string) {
    const plan = input.plan as SubscriptionPlan;
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription = await prisma.subscription.upsert({
      where: { businessId },
      create: {
        businessId,
        plan,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      },
      update: {
        plan,
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      },
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'UPDATE',
        entity: 'Subscription',
        entityId: subscription.id,
        newData: { plan },
      },
    });

    return this.getBillingOverview(businessId);
  }

  async assertWithinLimit(
    businessId: string,
    resource: 'conversations' | 'customers' | 'teamMembers'
  ) {
    const [subscription, usageCounts] = await Promise.all([
      billingRepository.getSubscription(businessId),
      billingRepository.getUsageCounts(businessId),
    ]);

    const plan = subscription?.plan ?? SubscriptionPlan.FREE;
    const limits = billingRepository.getPlanLimits(plan);
    const used = usageCounts[resource];
    const limit = limits[resource];

    if (used >= limit) {
      throw new ForbiddenError(
        `${resource} limit reached for your ${plan} plan (${used}/${limit}). Please upgrade.`
      );
    }
  }
}

export const billingService = new BillingService();
