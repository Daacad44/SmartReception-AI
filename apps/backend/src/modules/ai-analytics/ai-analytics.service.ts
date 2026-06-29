import { prisma } from '../../infrastructure/database/prisma';

function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  const d = startOfDay();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export class AiAnalyticsService {
  async getBusinessDashboard(businessId: string) {
    const now = new Date();
    const today = startOfDay();
    const weekAgo = daysAgo(7);
    const monthAgo = daysAgo(30);

    const [
      todayEvents,
      weekEvents,
      monthEvents,
      lifetimeEvents,
      dailyRollups,
      topCustomers,
      conversationCount,
      customerCount,
      activeCustomers,
    ] = await Promise.all([
      this.aggregateEvents(businessId, today),
      this.aggregateEvents(businessId, weekAgo),
      this.aggregateEvents(businessId, monthAgo),
      this.aggregateEvents(businessId, new Date(0)),
      prisma.aiDailyRollup.findMany({
        where: { businessId, date: { gte: monthAgo } },
        orderBy: { date: 'asc' },
      }),
      prisma.aiCustomerMetric.findMany({
        where: { businessId },
        orderBy: { estimatedCostUsd: 'desc' },
        take: 10,
      }),
      prisma.conversation.count({ where: { businessId } }),
      prisma.customer.count({ where: { businessId, isActive: true } }),
      prisma.customer.count({
        where: { businessId, isActive: true, lastContactAt: { gte: monthAgo } },
      }),
    ]);

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const predictedMonthCost =
      dayOfMonth > 0 ? (monthEvents.estimatedCostUsd / dayOfMonth) * daysInMonth : 0;

    const categoryCounts = await prisma.aiUsageEvent.groupBy({
      by: ['route'],
      where: { businessId, createdAt: { gte: monthAgo }, route: { not: null } },
      _count: { id: true },
    });

    const hourly = await prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`
      SELECT EXTRACT(HOUR FROM "createdAt")::int AS hour, COUNT(*)::bigint AS count
      FROM "ai_usage_events"
      WHERE "businessId" = ${businessId} AND "createdAt" >= ${monthAgo}
      GROUP BY 1 ORDER BY 1
    `;

    return {
      usage: {
        today: todayEvents,
        thisWeek: weekEvents,
        thisMonth: monthEvents,
        lifetime: lifetimeEvents,
        predictedEndOfMonthCost: predictedMonthCost,
      },
      conversations: {
        total: conversationCount,
        avgLength: lifetimeEvents.totalRequests
          ? lifetimeEvents.totalTokens / Math.max(lifetimeEvents.totalRequests, 1)
          : 0,
      },
      customers: {
        total: customerCount,
        active: activeCustomers,
        returning: topCustomers.filter((c) => c.conversationCount > 1).length,
      },
      performance: {
        avgResponseTimeMs: monthEvents.avgLatencyMs,
        avgTokensPerConversation: conversationCount
          ? monthEvents.totalTokens / conversationCount
          : 0,
        avgTokensPerCustomer: customerCount ? monthEvents.totalTokens / customerCount : 0,
        tokenSavingsPercent: monthEvents.tokenSavingsPercent,
        searchSuccessRate: monthEvents.searchSuccessRate,
        fallbackRate: monthEvents.fallbackRate,
      },
      charts: {
        dailyTokens: dailyRollups.map((r) => ({
          date: r.date,
          tokens: r.totalTokens,
          cost: Number(r.estimatedCostUsd),
        })),
        providerUsage: monthEvents.providerBreakdown,
        peakHours: hourly.map((h) => ({ hour: h.hour, count: Number(h.count) })),
        topCategories: categoryCounts.map((c) => ({ category: c.route, count: c._count.id })),
      },
      topCustomers: topCustomers.map((c) => ({
        customerId: c.customerId,
        conversationCount: c.conversationCount,
        messageCount: c.messageCount,
        totalTokens: c.inputTokens + c.outputTokens,
        estimatedCostUsd: Number(c.estimatedCostUsd),
      })),
      knowledge: {
        chunkCount: await prisma.knowledgeChunk.count({ where: { businessId, isActive: true } }),
        avgRetrievedChunks: monthEvents.avgRetrievedChunks,
      },
    };
  }

  async getPlatformDashboard() {
    const monthAgo = daysAgo(30);
    const [businessCount, events, providerBreakdown, topBusinesses] = await Promise.all([
      prisma.business.count({ where: { isActive: true } }),
      prisma.aiUsageEvent.aggregate({
        where: { createdAt: { gte: monthAgo } },
        _count: { id: true },
        _sum: { totalTokens: true, estimatedCostUsd: true, inputTokens: true, outputTokens: true },
        _avg: { latencyMs: true, tokenSavingsPercent: true },
      }),
      prisma.aiUsageEvent.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: monthAgo } },
        _count: { id: true },
        _sum: { totalTokens: true },
      }),
      prisma.aiUsageEvent.groupBy({
        by: ['businessId'],
        where: { createdAt: { gte: monthAgo } },
        _count: { id: true },
        _sum: { totalTokens: true, estimatedCostUsd: true },
      }),
    ]);

    const sortedTopBusinesses = [...topBusinesses]
      .sort((a, b) => (b._sum.totalTokens ?? 0) - (a._sum.totalTokens ?? 0))
      .slice(0, 10);
    const businessNames = await prisma.business.findMany({
      where: { id: { in: sortedTopBusinesses.map((b) => b.businessId) } },
      select: { id: true, name: true },
    });
    const nameMap = new Map(businessNames.map((b) => [b.id, b.name]));

    return {
      totalBusinesses: businessCount,
      totalAiRequests: events._count.id,
      totalTokens: events._sum.totalTokens ?? 0,
      totalAiCost: Number(events._sum.estimatedCostUsd ?? 0),
      avgLatencyMs: Math.round(events._avg.latencyMs ?? 0),
      avgTokenSavingsPercent: events._avg.tokenSavingsPercent ?? 0,
      providerDistribution: providerBreakdown.map((p) => ({
        provider: p.provider,
        requests: p._count.id,
        tokens: p._sum.totalTokens ?? 0,
      })),
      topBusinesses: sortedTopBusinesses.map((b) => ({
        businessId: b.businessId,
        name: nameMap.get(b.businessId) ?? 'Unknown',
        requests: b._count.id,
        tokens: b._sum.totalTokens ?? 0,
        cost: Number(b._sum.estimatedCostUsd ?? 0),
      })),
    };
  }

  async getCustomerAnalytics(businessId: string, customerId: string) {
    const metric = await prisma.aiCustomerMetric.findUnique({
      where: { businessId_customerId: { businessId, customerId } },
    });
    const events = await prisma.aiUsageEvent.findMany({
      where: { businessId, customerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { metric, recentEvents: events };
  }

  async getConversationAnalytics(businessId: string, conversationId: string) {
    const metric = await prisma.aiConversationMetric.findUnique({ where: { conversationId } });
    const events = await prisma.aiUsageEvent.findMany({
      where: { businessId, conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return { metric, events };
  }

  private async aggregateEvents(businessId: string, since: Date) {
    const agg = await prisma.aiUsageEvent.aggregate({
      where: { businessId, createdAt: { gte: since } },
      _count: { id: true },
      _sum: {
        totalTokens: true,
        inputTokens: true,
        outputTokens: true,
        estimatedCostUsd: true,
        retrievedChunkCount: true,
        baselineTokensEstimate: true,
      },
      _avg: { latencyMs: true, retrievedChunkCount: true, tokenSavingsPercent: true },
    });

    const total = agg._count.id;
    const fallbackCount = await prisma.aiUsageEvent.count({
      where: { businessId, createdAt: { gte: since }, fallbackUsed: true },
    });
    const searchSuccessCount = await prisma.aiUsageEvent.count({
      where: { businessId, createdAt: { gte: since }, retrievedChunkCount: { gt: 0 } },
    });

    const providerRows = await prisma.aiUsageEvent.groupBy({
      by: ['provider'],
      where: { businessId, createdAt: { gte: since } },
      _count: { id: true },
    });

    const baseline = agg._sum.baselineTokensEstimate ?? 0;
    const used = agg._sum.totalTokens ?? 0;
    const savingsPercent = baseline > 0 ? ((baseline - used) / baseline) * 100 : agg._avg.tokenSavingsPercent ?? 0;

    return {
      totalRequests: total,
      totalTokens: used,
      inputTokens: agg._sum.inputTokens ?? 0,
      outputTokens: agg._sum.outputTokens ?? 0,
      estimatedCostUsd: Number(agg._sum.estimatedCostUsd ?? 0),
      avgLatencyMs: Math.round(agg._avg.latencyMs ?? 0),
      avgRetrievedChunks: agg._avg.retrievedChunkCount ?? 0,
      tokenSavingsPercent: savingsPercent,
      searchSuccessRate: total ? (searchSuccessCount / total) * 100 : 0,
      fallbackRate: total ? (fallbackCount / total) * 100 : 0,
      providerBreakdown: Object.fromEntries(
        providerRows.map((r) => [r.provider, r._count.id])
      ),
    };
  }
}

export const aiAnalyticsService = new AiAnalyticsService();
