import { prisma } from '../../infrastructure/database/prisma';
import {
  aiAnalyticsRepository,
  daysAgo,
  startOfDay,
  type AnalyticsFilters,
} from './ai-analytics.repository';
import { businessSnapshotService } from './business-snapshot.service';
import { historicalBackfillService } from './historical-backfill.service';

export type { AnalyticsFilters };

export class AiAnalyticsService {
  async getBusinessDashboard(businessId: string) {
    await businessSnapshotService.refresh(businessId);
    const snapshot = await prisma.aiBusinessSnapshot.findUnique({ where: { businessId } });
    const monthAgo = daysAgo(30);

    const [
      dailySeries,
      customers,
      conversations,
      tokenIntel,
      costIntel,
      peakHours,
      peakDays,
      topDocuments,
    ] = await Promise.all([
      aiAnalyticsRepository.getDailyTokenSeries(businessId, 30),
      aiAnalyticsRepository.listCustomersWithAnalytics(businessId),
      aiAnalyticsRepository.listConversationsWithAnalytics(businessId),
      this.getTokenIntelligence(businessId),
      this.getCostIntelligence(businessId),
      this.getPeakHours(businessId, monthAgo),
      this.getPeakDays(businessId, monthAgo),
      this.getTopRetrievedDocuments(businessId),
    ]);

    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const predictedEndOfMonthCost =
      dayOfMonth > 0 ? (snapshot?.monthlyAiCost ? Number(snapshot.monthlyAiCost) / dayOfMonth * daysInMonth : 0) : 0;

    return {
      snapshot,
      usage: {
        today: {
          totalTokens: snapshot?.dailyTokens ?? 0,
          estimatedCostUsd: Number(snapshot?.estimatedAiCost ?? 0),
        },
        thisWeek: { totalTokens: snapshot?.weeklyTokens ?? 0 },
        thisMonth: {
          totalTokens: snapshot?.monthlyTokens ?? 0,
          estimatedCostUsd: Number(snapshot?.monthlyAiCost ?? 0),
        },
        lifetime: {
          totalTokens: snapshot?.lifetimeTokens ?? 0,
          estimatedCostUsd: Number(snapshot?.lifetimeAiCost ?? 0),
        },
        predictedEndOfMonthCost,
        projectedAnnualCost: predictedEndOfMonthCost * 12,
      },
      customers: {
        total: snapshot?.totalCustomers ?? 0,
        active: snapshot?.activeCustomers ?? 0,
        returning: snapshot?.returningCustomers ?? 0,
        list: customers.slice(0, 20),
      },
      conversations: {
        total: snapshot?.totalConversations ?? 0,
        totalCustomerMessages: snapshot?.totalCustomerMessages ?? 0,
        totalAiMessages: snapshot?.totalAiMessages ?? 0,
        avgTokensPerConversation: snapshot?.avgTokensPerConversation ?? 0,
        list: conversations.slice(0, 20),
      },
      performance: {
        avgResponseTimeMs: snapshot?.avgResponseTimeMs ?? 0,
        avgTokensPerCustomer: snapshot?.avgTokensPerCustomer ?? 0,
        tokenSavingsPercent: snapshot?.tokenSavingsPercent ?? 0,
        automationSuccessRate: snapshot?.automationSuccessRate ?? 0,
        healthScore: snapshot?.healthScore,
        topProvider: snapshot?.topProvider,
      },
      knowledge: {
        chunkCount: snapshot?.knowledgeBaseSize ?? 0,
        trainingStatus: snapshot?.trainingStatus,
        lastTrainingAt: snapshot?.lastTrainingAt,
        topDocuments,
      },
      tokenIntelligence: tokenIntel,
      costIntelligence: costIntel,
      charts: {
        dailyTokens: dailySeries,
        monthlyTokens: await aiAnalyticsRepository.getDailyTokenSeries(businessId, 365),
        conversationGrowth: await this.getConversationGrowth(businessId),
        customerGrowth: await this.getCustomerGrowth(businessId),
        providerUsage: await this.getProviderUsage(businessId, monthAgo),
        peakHours,
        peakDays,
        tokenSavings: dailySeries.map((d) => ({
          date: d.date,
          savings: Math.max(0, d.tokens * 0.7),
        })),
      },
    };
  }

  async listSuperAdminBusinessCards(page = 1, limit = 50, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          aiBusinessSnapshot: true,
          members: {
            where: { role: 'OWNER' },
            take: 1,
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
          },
        },
      }),
      prisma.business.count({ where }),
    ]);

    const cards = await Promise.all(
      businesses.map(async (b) => {
        if (!b.aiBusinessSnapshot) {
          await businessSnapshotService.refresh(b.id);
        }
        const snap = (await prisma.aiBusinessSnapshot.findUnique({ where: { businessId: b.id } }))!;
        return {
          businessId: b.id,
          name: b.name,
          logoUrl: b.logoUrl,
          industry: b.industry,
          status: b.isActive ? 'ACTIVE' : 'INACTIVE',
          licenseStatus: b.licenseStatus,
          createdAt: b.createdAt,
          owner: b.members[0]?.user ?? null,
          lastActivity: snap?.lastActivityAt,
          totalCustomers: snap?.totalCustomers ?? 0,
          activeCustomers: snap?.activeCustomers ?? 0,
          returningCustomers: snap?.returningCustomers ?? 0,
          totalConversations: snap?.totalConversations ?? 0,
          totalCustomerMessages: snap?.totalCustomerMessages ?? 0,
          totalAiMessages: snap?.totalAiMessages ?? 0,
          totalTokens: snap?.totalTokens ?? 0,
          inputTokens: snap?.inputTokens ?? 0,
          outputTokens: snap?.outputTokens ?? 0,
          dailyTokens: snap?.dailyTokens ?? 0,
          weeklyTokens: snap?.weeklyTokens ?? 0,
          monthlyTokens: snap?.monthlyTokens ?? 0,
          lifetimeTokens: snap?.lifetimeTokens ?? 0,
          avgTokensPerConversation: snap?.avgTokensPerConversation ?? 0,
          avgTokensPerCustomer: snap?.avgTokensPerCustomer ?? 0,
          estimatedAiCost: Number(snap?.estimatedAiCost ?? 0),
          monthlyAiCost: Number(snap?.monthlyAiCost ?? 0),
          lifetimeAiCost: Number(snap?.lifetimeAiCost ?? 0),
          avgResponseTimeMs: snap?.avgResponseTimeMs ?? 0,
          topProvider: snap?.topProvider,
          knowledgeBaseSize: snap?.knowledgeBaseSize ?? 0,
          trainingStatus: snap?.trainingStatus,
          lastTrainingAt: snap?.lastTrainingAt,
          healthScore: snap?.healthScore,
          automationSuccessRate: snap?.automationSuccessRate ?? 0,
          tokenSavingsPercent: snap?.tokenSavingsPercent ?? 0,
        };
      })
    );

    return { data: cards, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getBusinessDetailAnalytics(businessId: string, filters: AnalyticsFilters = {}) {
    await businessSnapshotService.refresh(businessId);
    const dashboard = await this.getBusinessDashboard(businessId);

    const [customers, conversations, events, trainingJobs] = await Promise.all([
      aiAnalyticsRepository.listCustomersWithAnalytics(businessId, filters),
      aiAnalyticsRepository.listConversationsWithAnalytics(businessId, filters),
      prisma.aiUsageEvent.findMany({
        where: {
          businessId,
          ...(filters.customerId ? { customerId: filters.customerId } : {}),
          ...(filters.conversationId ? { conversationId: filters.conversationId } : {}),
          ...(filters.provider ? { provider: filters.provider } : {}),
          ...(filters.from || filters.to
            ? {
                createdAt: {
                  ...(filters.from ? { gte: filters.from } : {}),
                  ...(filters.to ? { lte: filters.to } : {}),
                },
              }
            : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.aiTrainingJob.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, type: true, status: true, createdAt: true, completedAt: true },
      }),
    ]);

    return {
      ...dashboard,
      customers,
      conversations,
      aiHistory: events,
      trainingHistory: trainingJobs,
    };
  }

  async getPlatformDashboard() {
    const businesses = await this.listSuperAdminBusinessCards(1, 1000);
    const monthAgo = daysAgo(30);

    const platformAgg = await prisma.aiUsageEvent.aggregate({
      where: { createdAt: { gte: monthAgo } },
      _count: { id: true },
      _sum: { totalTokens: true, estimatedCostUsd: true },
    });

    return {
      totalBusinesses: businesses.meta.total,
      totalAiRequests: platformAgg._count.id,
      totalTokens: platformAgg._sum.totalTokens ?? 0,
      totalAiCost: Number(platformAgg._sum.estimatedCostUsd ?? 0),
      businesses: businesses.data,
    };
  }

  async getCustomerAnalytics(businessId: string, customerId: string) {
    const [customer] = await aiAnalyticsRepository.listCustomersWithAnalytics(businessId, { customerId });
    const events = await prisma.aiUsageEvent.findMany({
      where: { businessId, customerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { customer, events };
  }

  async getConversationAnalytics(businessId: string, conversationId: string) {
    const [conversation] = await aiAnalyticsRepository.listConversationsWithAnalytics(businessId, {
      conversationId,
    });
    const events = await prisma.aiUsageEvent.findMany({
      where: { businessId, conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return { conversation, events };
  }

  async getTokenIntelligence(businessId: string) {
    const lifetime = await aiAnalyticsRepository.computeMergedTokenStats(businessId);
    const daily = await aiAnalyticsRepository.computeMergedTokenStats(businessId, startOfDay());
    const monthly = await aiAnalyticsRepository.computeMergedTokenStats(businessId, daysAgo(30));

    return {
      inputTokens: lifetime.inputTokens,
      outputTokens: lifetime.outputTokens,
      knowledgeTokens: Math.ceil(lifetime.knowledgeChars / 4),
      summaryTokens: Math.ceil(lifetime.summaryChars / 4),
      averagePromptSize: lifetime.requests ? Math.round(lifetime.promptChars / lifetime.requests) : 0,
      averageResponseSize: lifetime.requests ? Math.round(lifetime.responseChars / lifetime.requests) : 0,
      compressionPercent: lifetime.tokenSavingsPercent,
      tokenSavingsPercent: lifetime.tokenSavingsPercent,
      estimatedSavings: lifetime.tokenSavingsTokens,
      dailySavings: daily.tokenSavingsTokens,
      monthlySavings: monthly.tokenSavingsTokens,
      lifetimeSavings: lifetime.tokenSavingsTokens,
    };
  }

  async getCostIntelligence(businessId: string) {
    const today = startOfDay();
    const week = daysAgo(7);
    const month = daysAgo(30);
    const [todayCost, weekCost, monthCost, lifeCost, customers, conversations, messages] =
      await Promise.all([
        aiAnalyticsRepository.computeMergedTokenStats(businessId, today),
        aiAnalyticsRepository.computeMergedTokenStats(businessId, week),
        aiAnalyticsRepository.computeMergedTokenStats(businessId, month),
        aiAnalyticsRepository.computeMergedTokenStats(businessId),
        prisma.customer.count({ where: { businessId } }),
        prisma.conversation.count({ where: { businessId } }),
        aiAnalyticsRepository.computeMessageStats(businessId),
      ]);

    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    return {
      todayCost: todayCost.estimatedCostUsd,
      weeklyCost: weekCost.estimatedCostUsd,
      monthlyCost: monthCost.estimatedCostUsd,
      lifetimeCost: lifeCost.estimatedCostUsd,
      costPerCustomer: customers > 0 ? lifeCost.estimatedCostUsd / customers : 0,
      costPerConversation: conversations > 0 ? lifeCost.estimatedCostUsd / conversations : 0,
      costPerMessage: messages.total > 0 ? lifeCost.estimatedCostUsd / messages.total : 0,
      predictedEndOfMonthCost:
        dayOfMonth > 0 ? (monthCost.estimatedCostUsd / dayOfMonth) * daysInMonth : 0,
      projectedAnnualCost: lifeCost.estimatedCostUsd > 0 ? (monthCost.estimatedCostUsd / Math.max(dayOfMonth, 1)) * 365 : 0,
    };
  }

  async runBackfill(businessId?: string) {
    if (businessId) {
      await historicalBackfillService.backfillBusiness(businessId);
      return { businesses: 1 };
    }
    return historicalBackfillService.backfillAll();
  }

  private async getPeakHours(businessId: string, since: Date) {
    const rows = await prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`
      SELECT EXTRACT(HOUR FROM m."createdAt")::int AS hour, COUNT(*)::bigint AS count
      FROM "messages" m
      JOIN "conversations" c ON c."id" = m."conversationId"
      WHERE c."businessId" = ${businessId} AND m."createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1
    `;
    return rows.map((r) => ({ hour: r.hour, count: Number(r.count) }));
  }

  private async getPeakDays(businessId: string, since: Date) {
    const rows = await prisma.$queryRaw<Array<{ dow: number; count: bigint }>>`
      SELECT EXTRACT(DOW FROM m."createdAt")::int AS dow, COUNT(*)::bigint AS count
      FROM "messages" m
      JOIN "conversations" c ON c."id" = m."conversationId"
      WHERE c."businessId" = ${businessId} AND m."createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1
    `;
    return rows.map((r) => ({ day: r.dow, count: Number(r.count) }));
  }

  private async getProviderUsage(businessId: string, since: Date) {
    const rows = await prisma.aiUsageEvent.groupBy({
      by: ['provider'],
      where: { businessId, createdAt: { gte: since } },
      _count: { id: true },
      _sum: { totalTokens: true },
    });
    return rows.map((r) => ({
      provider: r.provider,
      requests: r._count.id,
      tokens: r._sum.totalTokens ?? 0,
    }));
  }

  private async getConversationGrowth(businessId: string) {
    const since = daysAgo(90);
    const rows = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT DATE("createdAt") AS day, COUNT(*)::bigint AS count
      FROM "conversations"
      WHERE "businessId" = ${businessId} AND "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1
    `;
    return rows.map((r) => ({ date: r.day, count: Number(r.count) }));
  }

  private async getCustomerGrowth(businessId: string) {
    const since = daysAgo(90);
    const rows = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
      SELECT DATE("createdAt") AS day, COUNT(*)::bigint AS count
      FROM "customers"
      WHERE "businessId" = ${businessId} AND "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1
    `;
    return rows.map((r) => ({ date: r.day, count: Number(r.count) }));
  }

  private async getTopRetrievedDocuments(businessId: string) {
    const events = await prisma.aiUsageEvent.findMany({
      where: { businessId, usedRag: true },
      select: { metadata: true, retrievedChunkCount: true },
      take: 200,
    });
    const counts = new Map<string, number>();
    for (const e of events) {
      const meta = e.metadata as { chunkIds?: string[] } | null;
      for (const id of meta?.chunkIds ?? []) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    const topIds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!topIds.length) return [];

    const chunks = await prisma.knowledgeChunk.findMany({
      where: { id: { in: topIds.map(([id]) => id) } },
      select: { id: true, title: true, category: true },
    });
    const titleMap = new Map(chunks.map((c) => [c.id, c.title ?? c.category ?? 'Document']));
    return topIds.map(([id, count]) => ({ id, title: titleMap.get(id) ?? id, count }));
  }
}

export const aiAnalyticsService = new AiAnalyticsService();
