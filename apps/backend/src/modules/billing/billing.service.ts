import { billingRepository } from './billing.repository';
import { SubscriptionPlan } from '@prisma/client';

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
}

export const billingService = new BillingService();
