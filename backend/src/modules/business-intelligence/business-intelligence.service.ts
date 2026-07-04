import { prisma } from '../../infrastructure/database/prisma';
import { analyticsService } from '../analytics/analytics.service';
import { aiAnalyticsService, type AnalyticsFilters } from '../ai-analytics/ai-analytics.service';
import { financialIntelligenceService } from '../financial-intelligence/financial-intelligence.service';

export interface BusinessIntelligenceFilters extends AnalyticsFilters {
  businessId?: string;
  plan?: string;
  country?: string;
  status?: string;
}

export class BusinessIntelligenceService {
  async getTenantDashboard(businessId: string, filters: BusinessIntelligenceFilters = {}) {
    const [businessAnalytics, aiAnalytics, financialSummary] = await Promise.all([
      analyticsService.getFullAnalytics(businessId),
      aiAnalyticsService.getBusinessDashboard(businessId),
      financialIntelligenceService.getBusinessFinancialProfile(businessId).catch(() => null),
    ]);

    return this.buildUnifiedDashboard({
      businessId,
      businessAnalytics,
      aiAnalytics,
      financialProfile: financialSummary?.profile ?? null,
      filters,
    });
  }

  async getAdminDashboard(filters: BusinessIntelligenceFilters = {}) {
    const [platformAi, platformFinancial, businessCount, customerCount, conversationCount] =
      await Promise.all([
        aiAnalyticsService.getPlatformDashboard(),
        financialIntelligenceService.getPlatformDashboard(),
        prisma.business.count({ where: this.businessWhere(filters) }),
        prisma.customer.count({
          where: filters.businessId ? { businessId: filters.businessId } : undefined,
        }),
        prisma.conversation.count({
          where: filters.businessId ? { businessId: filters.businessId } : undefined,
        }),
      ]);

    const tokenBreakdown = await this.getPlatformTokenBreakdown(filters);

    const aiMessageTotals = platformAi.businesses.reduce(
      (acc, b) => ({
        aiMessages: acc.aiMessages + (b.totalAiMessages ?? 0),
        customerMessages: acc.customerMessages + (b.totalCustomerMessages ?? 0),
      }),
      { aiMessages: 0, customerMessages: 0 }
    );

    return {
      overview: {
        businesses: businessCount,
        customers: customerCount,
        conversations: conversationCount,
        messagesSent: aiMessageTotals.aiMessages,
        messagesReceived: aiMessageTotals.customerMessages,
        aiRequests: platformAi.totalAiRequests ?? 0,
        aiResponses: aiMessageTotals.aiMessages,
        knowledgeSearches: 0,
        ragRetrievalCount: 0,
      },
      tokens: tokenBreakdown,
      costs: {
        openai: 0,
        gemini: Number(platformFinancial.aiCostUsd ?? 0),
        claude: 0,
        whatsapp: Number(platformFinancial.whatsappCostUsd ?? 0),
        email: Number(platformFinancial.emailCostUsd ?? 0),
        storage: Number(platformFinancial.storageCostUsd ?? 0),
        infrastructure: Number(platformFinancial.infrastructureCostUsd ?? 0),
        operating: Number(platformFinancial.totalOperatingCostUsd ?? 0),
      },
      financial: {
        revenue: Number(platformFinancial.monthlyRevenueUsd ?? 0),
        profit: Number(platformFinancial.netProfitUsd ?? 0),
        mrr: Number(platformFinancial.totalMrrUsd ?? 0),
        arr: Number(platformFinancial.totalArrUsd ?? 0),
      },
      growth: {
        customerGrowth: [],
        businessGrowth: [],
        conversationGrowth: [],
      },
      usage: {
        daily: platformFinancial.trends?.aiCost ?? [],
        monthly: { totalTokens: platformAi.totalTokens ?? 0 },
        peak: [],
      },
      rankings: {
        topBusinesses: (platformFinancial.topRevenueBusinesses ?? []).map((b) => ({
          businessId: b.businessId,
          name: b.name,
          revenueUsd: b.revenueUsd,
        })),
        topCustomers: [],
        topAiConsumers: (platformFinancial.topAiCostBusinesses ?? []).map((b) => ({
          businessId: b.businessId,
          name: b.name,
          costUsd: b.costUsd,
        })),
        topStorageConsumers: (platformFinancial.topStorageBusinesses ?? []).map((b) => ({
          businessId: b.businessId,
          name: b.name,
          costUsd: b.costUsd,
        })),
      },
      platformAi,
      platformFinancial,
      filters,
    };
  }

  async listBusinesses(page = 1, limit = 50, search?: string, filters: BusinessIntelligenceFilters = {}) {
    const result = await aiAnalyticsService.listSuperAdminBusinessCards(page, limit, search);
    const enriched = await Promise.all(
      result.data.map(async (card) => {
        const financial = await prisma.businessFinancialProfile.findUnique({
          where: { businessId: card.businessId },
        });
        return {
          ...card,
          revenue: Number(financial?.monthlyRevenueUsd ?? 0),
          profit: Number(financial?.netProfitUsd ?? 0),
          mrr: Number(financial?.mrrContributionUsd ?? 0),
          operatingCost: Number(financial?.totalOperatingCostUsd ?? 0),
        };
      })
    );
    return { data: enriched, meta: result.meta };
  }

  async getBusinessDetail(businessId: string, filters: BusinessIntelligenceFilters = {}) {
    const [businessAnalytics, aiAnalytics, financial] = await Promise.all([
      analyticsService.getFullAnalytics(businessId),
      aiAnalyticsService.getBusinessDashboard(businessId),
      financialIntelligenceService.getBusinessFinancialProfile(businessId).catch(() => null),
    ]);

    return this.buildUnifiedDashboard({
      businessId,
      businessAnalytics,
      aiAnalytics,
      financialProfile: financial?.profile ?? null,
      filters,
      business: financial?.business ?? null,
    });
  }

  private buildUnifiedDashboard(input: {
    businessId: string;
    businessAnalytics: Awaited<ReturnType<typeof analyticsService.getFullAnalytics>>;
    aiAnalytics: Awaited<ReturnType<typeof aiAnalyticsService.getBusinessDashboard>>;
    financialProfile: {
      monthlyRevenueUsd?: unknown;
      netProfitUsd?: unknown;
      mrrContributionUsd?: unknown;
      arrContributionUsd?: unknown;
      aiCostUsd?: unknown;
      whatsappCostUsd?: unknown;
      emailCostUsd?: unknown;
      storageCostUsd?: unknown;
      infrastructureCostUsd?: unknown;
      totalOperatingCostUsd?: unknown;
    } | null;
    filters: BusinessIntelligenceFilters;
    business?: { id: string; name: string; industry?: string | null; country?: string | null } | null;
  }) {
    const { businessAnalytics, aiAnalytics, financialProfile } = input;
    const snapshot = aiAnalytics.snapshot;

    return {
      businessId: input.businessId,
      business: input.business,
      filters: input.filters,
      metrics: {
        businesses: 1,
        customers: snapshot?.totalCustomers ?? 0,
        conversations: snapshot?.totalConversations ?? 0,
        messagesSent: snapshot?.totalAiMessages ?? 0,
        messagesReceived: snapshot?.totalCustomerMessages ?? 0,
        aiRequests: 0,
        aiResponses: snapshot?.totalAiMessages ?? 0,
        knowledgeSearches: 0,
        ragRetrievalCount: 0,
        totalMessages: businessAnalytics?.totalMessages ?? 0,
        avgResponseTime: businessAnalytics?.avgResponseTime ?? '—',
        satisfactionScore: businessAnalytics?.satisfactionScore ?? 0,
        aiHandledPercent: businessAnalytics?.aiHandledPercent ?? 0,
      },
      tokens: {
        inputTokens: snapshot?.inputTokens ?? aiAnalytics.tokenIntelligence?.inputTokens ?? 0,
        outputTokens: snapshot?.outputTokens ?? aiAnalytics.tokenIntelligence?.outputTokens ?? 0,
        cachedTokens: 0,
        retrievedTokens: 0,
        summaryTokens: 0,
        embeddingTokens: 0,
        trainingTokens: 0,
        totalTokens: snapshot?.lifetimeTokens ?? aiAnalytics.usage?.lifetime?.totalTokens ?? 0,
        daily: snapshot?.dailyTokens ?? 0,
        monthly: snapshot?.monthlyTokens ?? aiAnalytics.usage?.thisMonth?.totalTokens ?? 0,
      },
      costs: {
        openai: 0,
        gemini: Number(financialProfile?.aiCostUsd ?? aiAnalytics.usage?.thisMonth?.estimatedCostUsd ?? 0),
        claude: 0,
        whatsapp: Number(financialProfile?.whatsappCostUsd ?? 0),
        email: Number(financialProfile?.emailCostUsd ?? 0),
        storage: Number(financialProfile?.storageCostUsd ?? 0),
        infrastructure: Number(financialProfile?.infrastructureCostUsd ?? 0),
        operating: Number(financialProfile?.totalOperatingCostUsd ?? 0),
        ai: Number(financialProfile?.aiCostUsd ?? aiAnalytics.usage?.thisMonth?.estimatedCostUsd ?? 0),
      },
      financial: {
        revenue: Number(financialProfile?.monthlyRevenueUsd ?? 0),
        profit: Number(financialProfile?.netProfitUsd ?? 0),
        mrr: Number(financialProfile?.mrrContributionUsd ?? 0),
        arr: Number(financialProfile?.arrContributionUsd ?? 0),
      },
      performance: aiAnalytics.performance,
      knowledge: aiAnalytics.knowledge,
      charts: {
        hourlyActivity: businessAnalytics?.hourlyActivity ?? [],
        channelBreakdown: businessAnalytics?.channelBreakdown ?? [],
        topTopics: businessAnalytics?.topTopics ?? [],
        dailyTokens: aiAnalytics.charts?.dailyTokens ?? [],
        providerUsage: aiAnalytics.charts?.providerUsage ?? [],
        peakHours: aiAnalytics.charts?.peakHours ?? [],
        customerGrowth: aiAnalytics.charts?.customerGrowth ?? [],
        conversationGrowth: aiAnalytics.charts?.conversationGrowth ?? [],
      },
      businessAnalytics,
      aiAnalytics,
    };
  }

  private businessWhere(filters: BusinessIntelligenceFilters) {
    const where: Record<string, unknown> = {};
    if (filters.businessId) where.id = filters.businessId;
    if (filters.country) where.country = filters.country;
    if (filters.status === 'ACTIVE') where.isActive = true;
    if (filters.status === 'INACTIVE') where.isActive = false;
    return where;
  }

  private async getPlatformTokenBreakdown(filters: BusinessIntelligenceFilters) {
    const from = filters.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await prisma.aiUsageEvent.aggregate({
      where: {
        createdAt: { gte: from },
        ...(filters.businessId ? { businessId: filters.businessId } : {}),
        ...(filters.provider ? { provider: filters.provider } : {}),
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
      },
      _count: { id: true },
    });

    return {
      inputTokens: events._sum.inputTokens ?? 0,
      outputTokens: events._sum.outputTokens ?? 0,
      cachedTokens: 0,
      retrievedTokens: 0,
      summaryTokens: 0,
      embeddingTokens: 0,
      trainingTokens: 0,
      totalTokens: events._sum.totalTokens ?? 0,
      eventCount: events._count.id ?? 0,
    };
  }
}

export const businessIntelligenceService = new BusinessIntelligenceService();
