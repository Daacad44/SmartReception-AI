import { prisma } from '../../../infrastructure/database/prisma';
import { daysAgo } from '../../ai-analytics/ai-analytics.repository';
import type { BusinessRevenueBreakdown } from '../financial.types';

const PAID_STATUSES = ['PAID', 'MANUAL', 'COMPLIMENTARY'] as const;

function toNumber(value: unknown): number {
  if (value == null) return 0;
  return Number(value);
}

export class RevenueEngineService {
  async calculateBusinessRevenue(businessId: string): Promise<BusinessRevenueBreakdown> {
    const thirtyDaysAgo = daysAgo(30);
    const yearStart = new Date(new Date().getUTCFullYear(), 0, 1);

    const [subscription, payments, refunds, failed, invoices, customers, prevMonthPayments] =
      await Promise.all([
        prisma.businessSubscription.findUnique({
          where: { businessId },
          include: { plan: true },
        }),
        prisma.subscriptionPayment.findMany({
          where: {
            businessId,
            status: { in: [...PAID_STATUSES] },
          },
        }),
        prisma.subscriptionTransaction.aggregate({
          where: { businessId, type: 'REFUND', status: 'COMPLETED' },
          _sum: { amount: true },
        }),
        prisma.subscriptionPayment.aggregate({
          where: { businessId, status: 'FAILED' },
          _sum: { amount: true },
        }),
        prisma.invoice.aggregate({
          where: { businessId, status: { in: ['OPEN', 'DRAFT'] } },
          _sum: { amount: true },
        }),
        prisma.customer.count({ where: { businessId, isActive: true } }),
        prisma.subscriptionPayment.aggregate({
          where: {
            businessId,
            status: { in: [...PAID_STATUSES] },
            paidAt: { gte: daysAgo(60), lt: thirtyDaysAgo },
          },
          _sum: { amount: true },
        }),
      ]);

    const lifetimeRevenueUsd = payments.reduce(
      (sum: number, p: (typeof payments)[number]) => sum + toNumber(p.amount),
      0
    );
    const monthlyPayments = payments.filter(
      (p: (typeof payments)[number]) => p.paidAt && p.paidAt >= thirtyDaysAgo
    );
    const monthlyRevenueUsd = monthlyPayments.reduce(
      (sum: number, p: (typeof payments)[number]) => sum + toNumber(p.amount),
      0
    );
    const yearlyRevenueUsd = payments
      .filter((p: (typeof payments)[number]) => p.paidAt && p.paidAt >= yearStart)
      .reduce((sum: number, p: (typeof payments)[number]) => sum + toNumber(p.amount), 0);

    let mrrContributionUsd = 0;
    let arrContributionUsd = 0;

    if (subscription?.plan && subscription.status === 'ACTIVE') {
      const monthlyPrice = toNumber(subscription.plan.monthlyPrice);
      const yearlyPrice = toNumber(subscription.plan.yearlyPrice);
      if (subscription.billingCycle === 'YEARLY' && yearlyPrice > 0) {
        mrrContributionUsd = yearlyPrice / 12;
        arrContributionUsd = yearlyPrice;
      } else {
        mrrContributionUsd = monthlyPrice;
        arrContributionUsd = monthlyPrice * 12;
      }

      const discount = toNumber(subscription.discountPercent);
      if (discount > 0) {
        mrrContributionUsd *= 1 - discount / 100;
        arrContributionUsd *= 1 - discount / 100;
      }
    }

    const prevMonthRevenue = toNumber(prevMonthPayments._sum?.amount);
    const revenueGrowthPercent =
      prevMonthRevenue > 0
        ? ((monthlyRevenueUsd - prevMonthRevenue) / prevMonthRevenue) * 100
        : monthlyRevenueUsd > 0
          ? 100
          : 0;
    const revenueDeclinePercent = revenueGrowthPercent < 0 ? Math.abs(revenueGrowthPercent) : 0;

    const byMonthMap = new Map<string, number>();
    for (const payment of payments) {
      if (!payment.paidAt) continue;
      const key = `${payment.paidAt.getUTCFullYear()}-${String(payment.paidAt.getUTCMonth() + 1).padStart(2, '0')}`;
      byMonthMap.set(key, (byMonthMap.get(key) ?? 0) + toNumber(payment.amount));
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { country: true },
    });

    return {
      monthlyRevenueUsd: Math.max(monthlyRevenueUsd, mrrContributionUsd),
      yearlyRevenueUsd: Math.max(yearlyRevenueUsd, arrContributionUsd),
      lifetimeRevenueUsd,
      mrrContributionUsd,
      arrContributionUsd,
      failedPaymentsUsd: toNumber(failed._sum.amount),
      refundsUsd: toNumber(refunds._sum.amount),
      outstandingInvoicesUsd: toNumber(invoices._sum?.amount),
      recurringRevenueUsd: mrrContributionUsd,
      revenuePerCustomerUsd: customers > 0 ? lifetimeRevenueUsd / customers : 0,
      revenueGrowthPercent,
      revenueDeclinePercent,
      byPlan: subscription?.plan
        ? [
            {
              planCode: subscription.plan.code,
              planName: subscription.plan.name,
              revenueUsd: lifetimeRevenueUsd,
            },
          ]
        : [],
      byCountry: business?.country
        ? [{ country: business.country, revenueUsd: lifetimeRevenueUsd }]
        : [],
      byMonth: [...byMonthMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, revenueUsd]) => ({ month, revenueUsd })),
    };
  }

  async calculatePlatformRevenue() {
    const businesses = await prisma.business.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const revenues = await Promise.all(
      businesses.map((b: (typeof businesses)[number]) => this.calculateBusinessRevenue(b.id))
    );

    return revenues.reduce(
      (acc: {
        totalMrrUsd: number;
        totalArrUsd: number;
        monthlyRevenueUsd: number;
        yearlyRevenueUsd: number;
        lifetimeRevenueUsd: number;
        failedPaymentsUsd: number;
        refundsUsd: number;
        outstandingInvoicesUsd: number;
      }, r: BusinessRevenueBreakdown) => ({
        totalMrrUsd: acc.totalMrrUsd + r.mrrContributionUsd,
        totalArrUsd: acc.totalArrUsd + r.arrContributionUsd,
        monthlyRevenueUsd: acc.monthlyRevenueUsd + r.monthlyRevenueUsd,
        yearlyRevenueUsd: acc.yearlyRevenueUsd + r.yearlyRevenueUsd,
        lifetimeRevenueUsd: acc.lifetimeRevenueUsd + r.lifetimeRevenueUsd,
        failedPaymentsUsd: acc.failedPaymentsUsd + r.failedPaymentsUsd,
        refundsUsd: acc.refundsUsd + r.refundsUsd,
        outstandingInvoicesUsd: acc.outstandingInvoicesUsd + r.outstandingInvoicesUsd,
      }),
      {
        totalMrrUsd: 0,
        totalArrUsd: 0,
        monthlyRevenueUsd: 0,
        yearlyRevenueUsd: 0,
        lifetimeRevenueUsd: 0,
        failedPaymentsUsd: 0,
        refundsUsd: 0,
        outstandingInvoicesUsd: 0,
      }
    );
  }
}

export const revenueEngineService = new RevenueEngineService();
