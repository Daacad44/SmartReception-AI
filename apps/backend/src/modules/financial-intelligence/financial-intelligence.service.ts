import { prisma } from '../../infrastructure/database/prisma';
import { getBusinessUsageSnapshot } from '../subscription/subscription-usage.service';
import { costEngineService } from './cost-engine/cost-engine.service';
import { revenueEngineService } from './revenue/revenue-engine.service';
import { profitEngineService } from './profit/profit-engine.service';
import { financialAlertService } from './alerts/financial-alert.service';
import { forecastService, pricingSimulatorService } from './simulator/pricing-simulator.service';
import type {
  PlatformFinancialDashboard,
  SimulatorPlanInput,
} from './financial.types';
import { daysAgo } from '../ai-analytics/ai-analytics.repository';

export class FinancialIntelligenceService {
  async refreshBusinessProfile(businessId: string) {
    const [business, subscription, revenue, costs, customers, conversations, aiSnapshot] =
      await Promise.all([
        prisma.business.findUnique({
          where: { id: businessId },
          select: { id: true, name: true, isActive: true },
        }),
        prisma.businessSubscription.findUnique({
          where: { businessId },
          include: { plan: true },
        }),
        revenueEngineService.calculateBusinessRevenue(businessId),
        costEngineService.calculateBusinessCosts(businessId),
        prisma.customer.count({ where: { businessId, isActive: true } }),
        prisma.conversation.count({ where: { businessId } }),
        prisma.aiBusinessSnapshot.findUnique({ where: { businessId } }),
      ]);

    if (!business) return null;

    const profit = profitEngineService.calculateBusinessProfit(revenue, costs, {
      customers,
      conversations,
      totalTokens: aiSnapshot?.monthlyTokens ?? aiSnapshot?.totalTokens ?? 0,
    });

    const usage = subscription?.plan
      ? await getBusinessUsageSnapshot(businessId)
      : null;

    await financialAlertService.evaluateBusinessAlerts({
      businessId,
      revenue,
      costs,
      profit,
      usage: usage
        ? {
            aiTokensMonthly: aiSnapshot?.monthlyTokens ?? 0,
            aiTokenLimit: (subscription?.plan?.maxConversations ?? 0) * 1000,
            storageMb: usage.storageMb.used,
            storageLimitMb: usage.storageMb.limit,
            whatsappConversations: usage.conversations.used,
            whatsappLimit: usage.conversations.limit,
          }
        : undefined,
    });

    const profile = await prisma.businessFinancialProfile.upsert({
      where: { businessId },
      create: {
        businessId,
        subscriptionId: subscription?.id,
        planCode: subscription?.plan?.code,
        planName: subscription?.plan?.name,
        billingCycle: subscription?.billingCycle,
        currency: subscription?.currency ?? 'USD',
        monthlyRevenueUsd: revenue.monthlyRevenueUsd,
        yearlyRevenueUsd: revenue.yearlyRevenueUsd,
        lifetimeRevenueUsd: revenue.lifetimeRevenueUsd,
        mrrContributionUsd: revenue.mrrContributionUsd,
        arrContributionUsd: revenue.arrContributionUsd,
        failedPaymentsUsd: revenue.failedPaymentsUsd,
        refundsUsd: revenue.refundsUsd,
        outstandingInvoicesUsd: revenue.outstandingInvoicesUsd,
        aiCostUsd: costs.ai.monthlyCostUsd,
        whatsappCostUsd: costs.whatsapp.monthlyCostUsd,
        emailCostUsd: costs.email.monthlyCostUsd,
        storageCostUsd: costs.storage.monthlyCostUsd,
        infrastructureCostUsd: costs.infrastructure.monthlyCostUsd,
        databaseCostUsd: costs.database.monthlyCostUsd,
        redisCostUsd: costs.redis.monthlyCostUsd,
        monitoringCostUsd: costs.monitoring.monthlyCostUsd,
        backupCostUsd: costs.backup.monthlyCostUsd,
        totalOperatingCostUsd: costs.totalOperatingCostUsd,
        grossProfitUsd: profit.grossProfitUsd,
        netProfitUsd: profit.netProfitUsd,
        profitMarginPercent: profit.profitMarginPercent,
        operatingMarginPercent: profit.operatingMarginPercent,
        costRecoveryPercent: profit.costRecoveryPercent,
        roiPercent: profit.roiPercent,
        customerLifetimeValueUsd: profit.customerLifetimeValueUsd,
        avgProfitPerCustomerUsd: profit.avgProfitPerCustomerUsd,
        avgProfitPerConversationUsd: profit.avgProfitPerConversationUsd,
        avgProfitPerTokenUsd: profit.avgProfitPerTokenUsd,
        isProfitable: profit.isProfitable,
        isOperatingAtLoss: profit.isOperatingAtLoss,
        revenueBreakdown: revenue as object,
        costBreakdown: costs as object,
        usageBreakdown: usage as object,
        calculatedAt: new Date(),
      },
      update: {
        subscriptionId: subscription?.id,
        planCode: subscription?.plan?.code,
        planName: subscription?.plan?.name,
        billingCycle: subscription?.billingCycle,
        currency: subscription?.currency ?? 'USD',
        monthlyRevenueUsd: revenue.monthlyRevenueUsd,
        yearlyRevenueUsd: revenue.yearlyRevenueUsd,
        lifetimeRevenueUsd: revenue.lifetimeRevenueUsd,
        mrrContributionUsd: revenue.mrrContributionUsd,
        arrContributionUsd: revenue.arrContributionUsd,
        failedPaymentsUsd: revenue.failedPaymentsUsd,
        refundsUsd: revenue.refundsUsd,
        outstandingInvoicesUsd: revenue.outstandingInvoicesUsd,
        aiCostUsd: costs.ai.monthlyCostUsd,
        whatsappCostUsd: costs.whatsapp.monthlyCostUsd,
        emailCostUsd: costs.email.monthlyCostUsd,
        storageCostUsd: costs.storage.monthlyCostUsd,
        infrastructureCostUsd: costs.infrastructure.monthlyCostUsd,
        databaseCostUsd: costs.database.monthlyCostUsd,
        redisCostUsd: costs.redis.monthlyCostUsd,
        monitoringCostUsd: costs.monitoring.monthlyCostUsd,
        backupCostUsd: costs.backup.monthlyCostUsd,
        totalOperatingCostUsd: costs.totalOperatingCostUsd,
        grossProfitUsd: profit.grossProfitUsd,
        netProfitUsd: profit.netProfitUsd,
        profitMarginPercent: profit.profitMarginPercent,
        operatingMarginPercent: profit.operatingMarginPercent,
        costRecoveryPercent: profit.costRecoveryPercent,
        roiPercent: profit.roiPercent,
        customerLifetimeValueUsd: profit.customerLifetimeValueUsd,
        avgProfitPerCustomerUsd: profit.avgProfitPerCustomerUsd,
        avgProfitPerConversationUsd: profit.avgProfitPerConversationUsd,
        avgProfitPerTokenUsd: profit.avgProfitPerTokenUsd,
        isProfitable: profit.isProfitable,
        isOperatingAtLoss: profit.isOperatingAtLoss,
        revenueBreakdown: revenue as object,
        costBreakdown: costs as object,
        usageBreakdown: usage as object,
        calculatedAt: new Date(),
      },
    });

    if (subscription) {
      await prisma.businessSubscription.update({
        where: { id: subscription.id },
        data: {
          lifetimeRevenueUsd: revenue.lifetimeRevenueUsd,
          mrrContributionUsd: revenue.mrrContributionUsd,
          arrContributionUsd: revenue.arrContributionUsd,
        },
      });
    }

    return { business, profile, revenue, costs, profit };
  }

  async refreshAllBusinessProfiles() {
    const businesses = await prisma.business.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    let refreshed = 0;
    for (const business of businesses) {
      await this.refreshBusinessProfile(business.id);
      refreshed += 1;
    }
    return { refreshed };
  }

  async getBusinessFinancialProfile(businessId: string) {
    let profile = await prisma.businessFinancialProfile.findUnique({
      where: { businessId },
    });
    if (!profile || Date.now() - profile.calculatedAt.getTime() > 5 * 60 * 1000) {
      const refreshed = await this.refreshBusinessProfile(businessId);
      profile = refreshed?.profile ?? profile;
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, industry: true, country: true, logoUrl: true },
    });

    return { business, profile };
  }

  async getPlatformDashboard(): Promise<PlatformFinancialDashboard> {
    await this.refreshAllBusinessProfiles();

    const profiles = await prisma.businessFinancialProfile.findMany({
      include: { business: { select: { id: true, name: true, isActive: true } } },
    });

    const active = profiles.filter((p) => p.business.isActive);
    const sum = (fn: (p: (typeof profiles)[0]) => number) =>
      active.reduce((acc, p) => acc + fn(p), 0);

    const rankedByProfit = [...active].sort(
      (a, b) => Number(b.netProfitUsd) - Number(a.netProfitUsd)
    );
    const rankedByRevenue = [...active].sort(
      (a, b) => Number(b.monthlyRevenueUsd) - Number(a.monthlyRevenueUsd)
    );
    const rankedByAi = [...active].sort((a, b) => Number(b.aiCostUsd) - Number(a.aiCostUsd));
    const rankedByStorage = [...active].sort(
      (a, b) => Number(b.storageCostUsd) - Number(a.storageCostUsd)
    );
    const rankedByWhatsapp = [...active].sort(
      (a, b) => Number(b.whatsappCostUsd) - Number(a.whatsappCostUsd)
    );
    const rankedByEmail = [...active].sort(
      (a, b) => Number(b.emailCostUsd) - Number(a.emailCostUsd)
    );

    const totalMrrUsd = sum((p) => Number(p.mrrContributionUsd));
    const totalOperatingCostUsd = sum((p) => Number(p.totalOperatingCostUsd));
    const monthlyRevenueUsd = sum((p) => Number(p.monthlyRevenueUsd));
    const netProfitUsd = sum((p) => Number(p.netProfitUsd));

    const snapshots = await prisma.platformFinancialSnapshot.findMany({
      where: { snapshotDate: { gte: daysAgo(90) } },
      orderBy: { snapshotDate: 'asc' },
    });

    const mapTrend = (key: keyof (typeof snapshots)[0]) =>
      snapshots.map((s) => ({
        date: s.snapshotDate.toISOString().slice(0, 10),
        value: Number(s[key] ?? 0),
      }));

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await prisma.platformFinancialSnapshot.upsert({
      where: { snapshotDate: today },
      create: {
        snapshotDate: today,
        totalMrrUsd,
        totalArrUsd: totalMrrUsd * 12,
        monthlyRevenueUsd,
        yearlyRevenueUsd: sum((p) => Number(p.yearlyRevenueUsd)),
        lifetimeRevenueUsd: sum((p) => Number(p.lifetimeRevenueUsd)),
        totalOperatingCostUsd,
        aiCostUsd: sum((p) => Number(p.aiCostUsd)),
        whatsappCostUsd: sum((p) => Number(p.whatsappCostUsd)),
        emailCostUsd: sum((p) => Number(p.emailCostUsd)),
        storageCostUsd: sum((p) => Number(p.storageCostUsd)),
        infrastructureCostUsd: sum((p) => Number(p.infrastructureCostUsd)),
        databaseCostUsd: sum((p) => Number(p.databaseCostUsd)),
        redisCostUsd: sum((p) => Number(p.redisCostUsd)),
        monitoringCostUsd: sum((p) => Number(p.monitoringCostUsd)),
        backupCostUsd: sum((p) => Number(p.backupCostUsd)),
        grossProfitUsd: monthlyRevenueUsd - totalOperatingCostUsd,
        netProfitUsd,
        platformProfitMarginPercent:
          monthlyRevenueUsd > 0 ? (netProfitUsd / monthlyRevenueUsd) * 100 : 0,
        activeBusinessCount: active.length,
        profitableBusinessCount: active.filter((p) => p.isProfitable).length,
        lossBusinessCount: active.filter((p) => p.isOperatingAtLoss).length,
      },
      update: {
        totalMrrUsd,
        totalArrUsd: totalMrrUsd * 12,
        monthlyRevenueUsd,
        yearlyRevenueUsd: sum((p) => Number(p.yearlyRevenueUsd)),
        lifetimeRevenueUsd: sum((p) => Number(p.lifetimeRevenueUsd)),
        totalOperatingCostUsd,
        aiCostUsd: sum((p) => Number(p.aiCostUsd)),
        whatsappCostUsd: sum((p) => Number(p.whatsappCostUsd)),
        emailCostUsd: sum((p) => Number(p.emailCostUsd)),
        storageCostUsd: sum((p) => Number(p.storageCostUsd)),
        infrastructureCostUsd: sum((p) => Number(p.infrastructureCostUsd)),
        databaseCostUsd: sum((p) => Number(p.databaseCostUsd)),
        redisCostUsd: sum((p) => Number(p.redisCostUsd)),
        monitoringCostUsd: sum((p) => Number(p.monitoringCostUsd)),
        backupCostUsd: sum((p) => Number(p.backupCostUsd)),
        grossProfitUsd: monthlyRevenueUsd - totalOperatingCostUsd,
        netProfitUsd,
        platformProfitMarginPercent:
          monthlyRevenueUsd > 0 ? (netProfitUsd / monthlyRevenueUsd) * 100 : 0,
        activeBusinessCount: active.length,
        profitableBusinessCount: active.filter((p) => p.isProfitable).length,
        lossBusinessCount: active.filter((p) => p.isOperatingAtLoss).length,
      },
    });

    return {
      totalMrrUsd,
      totalArrUsd: totalMrrUsd * 12,
      monthlyRevenueUsd,
      yearlyRevenueUsd: sum((p) => Number(p.yearlyRevenueUsd)),
      lifetimeRevenueUsd: sum((p) => Number(p.lifetimeRevenueUsd)),
      totalOperatingCostUsd,
      aiCostUsd: sum((p) => Number(p.aiCostUsd)),
      whatsappCostUsd: sum((p) => Number(p.whatsappCostUsd)),
      emailCostUsd: sum((p) => Number(p.emailCostUsd)),
      storageCostUsd: sum((p) => Number(p.storageCostUsd)),
      infrastructureCostUsd: sum((p) => Number(p.infrastructureCostUsd)),
      databaseCostUsd: sum((p) => Number(p.databaseCostUsd)),
      redisCostUsd: sum((p) => Number(p.redisCostUsd)),
      monitoringCostUsd: sum((p) => Number(p.monitoringCostUsd)),
      backupCostUsd: sum((p) => Number(p.backupCostUsd)),
      grossProfitUsd: monthlyRevenueUsd - totalOperatingCostUsd,
      netProfitUsd,
      platformProfitMarginPercent:
        monthlyRevenueUsd > 0 ? (netProfitUsd / monthlyRevenueUsd) * 100 : 0,
      avgProfitPerBusinessUsd: active.length > 0 ? netProfitUsd / active.length : 0,
      activeBusinessCount: active.length,
      profitableBusinessCount: active.filter((p) => p.isProfitable).length,
      lossBusinessCount: active.filter((p) => p.isOperatingAtLoss).length,
      mostProfitableBusiness: rankedByProfit[0]
        ? {
            businessId: rankedByProfit[0].businessId,
            name: rankedByProfit[0].business?.name ?? '',
            profitUsd: Number(rankedByProfit[0].netProfitUsd),
          }
        : null,
      leastProfitableBusiness: rankedByProfit[rankedByProfit.length - 1]
        ? {
            businessId: rankedByProfit[rankedByProfit.length - 1].businessId,
            name: rankedByProfit[rankedByProfit.length - 1].business?.name ?? '',
            profitUsd: Number(rankedByProfit[rankedByProfit.length - 1].netProfitUsd),
          }
        : null,
      businessesAtLoss: active
        .filter((p) => p.isOperatingAtLoss)
        .slice(0, 10)
        .map((p) => ({
          businessId: p.businessId,
          name: p.business?.name ?? '',
          profitUsd: Number(p.netProfitUsd),
        })),
      topRevenueBusinesses: rankedByRevenue.slice(0, 10).map((p) => ({
        businessId: p.businessId,
        name: p.business?.name ?? '',
        revenueUsd: Number(p.monthlyRevenueUsd),
      })),
      topAiCostBusinesses: rankedByAi.slice(0, 10).map((p) => ({
        businessId: p.businessId,
        name: p.business?.name ?? '',
        costUsd: Number(p.aiCostUsd),
      })),
      topStorageBusinesses: rankedByStorage.slice(0, 10).map((p) => ({
        businessId: p.businessId,
        name: p.business?.name ?? '',
        costUsd: Number(p.storageCostUsd),
      })),
      topWhatsappBusinesses: rankedByWhatsapp.slice(0, 10).map((p) => ({
        businessId: p.businessId,
        name: p.business?.name ?? '',
        costUsd: Number(p.whatsappCostUsd),
      })),
      topEmailBusinesses: rankedByEmail.slice(0, 10).map((p) => ({
        businessId: p.businessId,
        name: p.business?.name ?? '',
        costUsd: Number(p.emailCostUsd),
      })),
      trends: {
        revenue: mapTrend('monthlyRevenueUsd'),
        cost: mapTrend('totalOperatingCostUsd'),
        profit: mapTrend('netProfitUsd'),
        mrr: mapTrend('totalMrrUsd'),
        arr: mapTrend('totalArrUsd'),
        aiCost: mapTrend('aiCostUsd'),
        storage: mapTrend('storageCostUsd'),
        whatsapp: mapTrend('whatsappCostUsd'),
        email: mapTrend('emailCostUsd'),
        infrastructure: mapTrend('infrastructureCostUsd'),
      },
      calculatedAt: new Date().toISOString(),
    };
  }

  async listBusinessProfiles(search?: string) {
    const profiles = await prisma.businessFinancialProfile.findMany({
      where: search
        ? { business: { name: { contains: search, mode: 'insensitive' } } }
        : undefined,
      include: {
        business: { select: { id: true, name: true, industry: true, logoUrl: true, isActive: true } },
      },
      orderBy: { netProfitUsd: 'desc' },
      take: 100,
    });
    return profiles;
  }

  async runSimulator(plans?: SimulatorPlanInput[]) {
    if (plans?.length) {
      return pricingSimulatorService.simulateAll(plans);
    }

    const catalog = await prisma.subscriptionPlanCatalog.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const activeCount = await prisma.business.count({ where: { isActive: true } });
    const perPlan = Math.max(1, Math.ceil(activeCount / Math.max(1, catalog.length)));

    const inputs: SimulatorPlanInput[] = catalog.map((plan) => ({
      planCode: plan.code,
      planName: plan.name,
      monthlyPriceUsd: Number(plan.monthlyPrice),
      yearlyPriceUsd: Number(plan.yearlyPrice),
      maxAiTokens: plan.maxConversations * 1000,
      maxStorageMb: plan.storageLimitMb,
      maxWhatsappConversations: plan.maxConversations,
      maxEmails: plan.appointmentLimit * 2,
      maxTeamMembers: plan.maxUsers,
      maxCustomers: plan.maxConversations,
      maxAiRequests: plan.maxConversations * 10,
      maxKnowledgeBaseSize: plan.knowledgeBaseLimit,
      maxAiTrainingSessions: plan.maxAiAgents * 5,
      expectedBusinessCount: perPlan,
    }));

    return pricingSimulatorService.simulateAll(inputs);
  }

  async getForecast() {
    const profiles = await prisma.businessFinancialProfile.findMany();
    const count = Math.max(1, profiles.length);
    const avgRevenuePerBusiness =
      profiles.reduce((s, p) => s + Number(p.monthlyRevenueUsd), 0) / count;
    const avgCostPerBusiness =
      profiles.reduce((s, p) => s + Number(p.totalOperatingCostUsd), 0) / count;
    const avgAiCostPerBusiness =
      profiles.reduce((s, p) => s + Number(p.aiCostUsd), 0) / count;
    const avgStorageGbPerBusiness =
      profiles.reduce((s, p) => {
        const breakdown = p.costBreakdown as { storage?: { breakdown?: { totalGb?: number } } };
        return s + (breakdown?.storage?.breakdown?.totalGb ?? 0);
      }, 0) / count;

    return forecastService.forecastScales({
      avgRevenuePerBusiness,
      avgCostPerBusiness,
      avgAiCostPerBusiness,
      avgStorageGbPerBusiness,
    });
  }
}

export const financialIntelligenceService = new FinancialIntelligenceService();
