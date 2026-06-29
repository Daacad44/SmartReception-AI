import { prisma } from '../../infrastructure/database/prisma';
import { estimateCostUsd, type AiProviderName } from '../../infrastructure/ai/providers/types';

export interface AnalyticsFilters {
  customerId?: string;
  conversationId?: string;
  provider?: string;
  channel?: string;
  from?: Date;
  to?: Date;
}

export function estimateTokensFromText(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function daysAgo(n: number): Date {
  const d = startOfDay();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export class AiAnalyticsRepository {
  async computeMessageStats(businessId: string, since?: Date) {
    const dateFilter = since ? { gte: since } : undefined;
    const [inbound, outboundAi, outboundHuman] = await Promise.all([
      prisma.message.count({
        where: {
          direction: 'INBOUND',
          createdAt: dateFilter,
          conversation: { businessId },
        },
      }),
      prisma.message.count({
        where: {
          direction: 'OUTBOUND',
          isAiGenerated: true,
          createdAt: dateFilter,
          conversation: { businessId },
        },
      }),
      prisma.message.count({
        where: {
          direction: 'OUTBOUND',
          isAiGenerated: false,
          createdAt: dateFilter,
          conversation: { businessId },
        },
      }),
    ]);
    return { inbound, outboundAi, outboundHuman, total: inbound + outboundAi + outboundHuman };
  }

  async computeTokensFromUsageEvents(businessId: string, since?: Date) {
    const agg = await prisma.aiUsageEvent.aggregate({
      where: {
        businessId,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        estimatedCostUsd: true,
        baselineTokensEstimate: true,
        knowledgeChars: true,
        summaryChars: true,
        promptChars: true,
        responseChars: true,
      },
      _avg: { latencyMs: true, tokenSavingsPercent: true },
      _count: { id: true },
    });

    return {
      requests: agg._count.id,
      inputTokens: agg._sum.inputTokens ?? 0,
      outputTokens: agg._sum.outputTokens ?? 0,
      totalTokens: agg._sum.totalTokens ?? 0,
      estimatedCostUsd: Number(agg._sum.estimatedCostUsd ?? 0),
      baselineTokens: agg._sum.baselineTokensEstimate ?? 0,
      knowledgeChars: agg._sum.knowledgeChars ?? 0,
      summaryChars: agg._sum.summaryChars ?? 0,
      promptChars: agg._sum.promptChars ?? 0,
      responseChars: agg._sum.responseChars ?? 0,
      avgLatencyMs: Math.round(agg._avg.latencyMs ?? 0),
      tokenSavingsPercent: agg._avg.tokenSavingsPercent ?? 0,
    };
  }

  async estimateHistoricalTokensFromMessages(businessId: string, since?: Date) {
    const messages = await prisma.message.findMany({
      where: {
        createdAt: since ? { gte: since } : undefined,
        conversation: { businessId },
        OR: [{ isAiGenerated: true }, { direction: 'INBOUND' }],
      },
      select: { content: true, isAiGenerated: true, direction: true },
    });

    let inputTokens = 0;
    let outputTokens = 0;
    for (const msg of messages) {
      const tokens = estimateTokensFromText(msg.content);
      if (msg.isAiGenerated || msg.direction === 'OUTBOUND') {
        outputTokens += tokens;
      } else {
        inputTokens += tokens;
      }
    }

    return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
  }

  async computeMergedTokenStats(businessId: string, since?: Date) {
    const [usage, historical] = await Promise.all([
      this.computeTokensFromUsageEvents(businessId, since),
      this.estimateHistoricalTokensFromMessages(businessId, since),
    ]);

    const trackedMessageIds = await prisma.aiUsageEvent.findMany({
      where: { businessId, messageId: { not: null }, ...(since ? { createdAt: { gte: since } } : {}) },
      select: { messageId: true },
    });
    const trackedSet = new Set(trackedMessageIds.map((e) => e.messageId!));

    let extraInput = 0;
    let extraOutput = 0;
    if (trackedSet.size === 0 && usage.requests === 0) {
      extraInput = historical.inputTokens;
      extraOutput = historical.outputTokens;
    } else if (usage.requests > 0) {
      const untracked = await prisma.message.findMany({
        where: {
          conversation: { businessId },
          isAiGenerated: true,
          ...(since ? { createdAt: { gte: since } } : {}),
          id: { notIn: [...trackedSet] },
        },
        select: { content: true },
      });
      extraOutput = untracked.reduce((sum, m) => sum + estimateTokensFromText(m.content), 0);
    }

    const inputTokens = usage.inputTokens + extraInput;
    const outputTokens = usage.outputTokens + extraOutput;
    const totalTokens = inputTokens + outputTokens;
    const baseline = usage.baselineTokens || totalTokens;
    const savingsTokens = Math.max(0, baseline - totalTokens);
    const tokenSavingsPercent = baseline > 0 ? (savingsTokens / baseline) * 100 : usage.tokenSavingsPercent;

    return {
      ...usage,
      inputTokens,
      outputTokens,
      totalTokens,
      tokenSavingsTokens: savingsTokens,
      tokenSavingsPercent,
      estimatedCostUsd:
        usage.estimatedCostUsd > 0
          ? usage.estimatedCostUsd + estimateCostUsd('gemini', extraInput, extraOutput)
          : estimateCostUsd('gemini', inputTokens, outputTokens),
    };
  }

  async computeCustomerCounts(businessId: string) {
    const monthAgo = daysAgo(30);
    const [total, active] = await Promise.all([
      prisma.customer.count({ where: { businessId, isActive: true } }),
      prisma.customer.count({
        where: { businessId, isActive: true, lastContactAt: { gte: monthAgo } },
      }),
    ]);

    const returningCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM (
        SELECT c."customerId"
        FROM "conversations" c
        WHERE c."businessId" = ${businessId}
        GROUP BY c."customerId"
        HAVING COUNT(*) > 1
      ) t
    `;

    return {
      total,
      active,
      returning: Number(returningCount[0]?.count ?? 0),
    };
  }

  async computeTrainingInfo(businessId: string) {
    const workspace = await prisma.aiTrainingWorkspace.findUnique({
      where: { businessId },
      include: {
        productionVersion: { select: { status: true, createdAt: true, readinessScore: true } },
        jobs: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, createdAt: true } },
      },
    });

    const chunkCount = await prisma.knowledgeChunk.count({ where: { businessId, isActive: true } });

    return {
      knowledgeBaseSize: chunkCount,
      trainingStatus: workspace?.productionVersion?.status ?? workspace?.jobs[0]?.status ?? 'NOT_STARTED',
      lastTrainingAt:
        workspace?.lastTrainedAt ??
        workspace?.productionVersion?.createdAt ??
        workspace?.jobs[0]?.createdAt ??
        null,
      healthScore: workspace?.aiReadinessScore ?? workspace?.productionVersion?.readinessScore ?? null,
    };
  }

  async computeAutomationSuccessRate(businessId: string) {
    const [aiResolved, total] = await Promise.all([
      prisma.conversation.count({
        where: { businessId, resolutionMethod: 'AI' },
      }),
      prisma.conversation.count({
        where: { businessId, resolutionMethod: { not: null } },
      }),
    ]);
    return total > 0 ? (aiResolved / total) * 100 : 0;
  }

  async getTopProvider(businessId: string, since?: Date) {
    const rows = await prisma.aiUsageEvent.groupBy({
      by: ['provider'],
      where: { businessId, ...(since ? { createdAt: { gte: since } } : {}) },
      _count: { id: true },
    });
    if (!rows.length) return 'gemini';
    return rows.sort((a, b) => b._count.id - a._count.id)[0]!.provider;
  }

  async getLastActivity(businessId: string) {
    const last = await prisma.conversation.findFirst({
      where: { businessId },
      orderBy: { lastMessageAt: 'desc' },
      select: { lastMessageAt: true },
    });
    return last?.lastMessageAt ?? null;
  }

  async getDailyTokenSeries(businessId: string, days = 30) {
    const since = daysAgo(days);
    const rollups = await prisma.aiDailyRollup.findMany({
      where: { businessId, date: { gte: since } },
      orderBy: { date: 'asc' },
    });

    if (rollups.length > 0) {
      return rollups.map((r) => ({
        date: r.date,
        tokens: r.totalTokens,
        cost: Number(r.estimatedCostUsd),
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
      }));
    }

    const rows = await prisma.$queryRaw<
      Array<{ day: Date; tokens: bigint; messages: bigint }>
    >`
      SELECT DATE(m."createdAt") AS day,
             SUM(LENGTH(m."content") / 4)::bigint AS tokens,
             COUNT(*)::bigint AS messages
      FROM "messages" m
      JOIN "conversations" c ON c."id" = m."conversationId"
      WHERE c."businessId" = ${businessId}
        AND m."createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `;

    return rows.map((r) => ({
      date: r.day,
      tokens: Number(r.tokens),
      cost: estimateCostUsd('gemini', Number(r.tokens) * 0.6, Number(r.tokens) * 0.4),
      inputTokens: 0,
      outputTokens: Number(r.tokens),
    }));
  }

  async listCustomersWithAnalytics(businessId: string, filters: AnalyticsFilters = {}) {
    const customers = await prisma.customer.findMany({
      where: {
        businessId,
        ...(filters.customerId ? { id: filters.customerId } : {}),
      },
      orderBy: { lastContactAt: 'desc' },
      take: 200,
    });

    return Promise.all(
      customers.map(async (customer) => {
        const [conversations, messages, metric, events] = await Promise.all([
          prisma.conversation.count({ where: { businessId, customerId: customer.id } }),
          prisma.message.count({
            where: {
              conversation: { businessId, customerId: customer.id },
              ...(filters.from || filters.to
                ? {
                    createdAt: {
                      ...(filters.from ? { gte: filters.from } : {}),
                      ...(filters.to ? { lte: filters.to } : {}),
                    },
                  }
                : {}),
            },
          }),
          prisma.aiCustomerMetric.findUnique({
            where: { businessId_customerId: { businessId, customerId: customer.id } },
          }),
          prisma.aiUsageEvent.aggregate({
            where: { businessId, customerId: customer.id },
            _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
            _avg: { latencyMs: true },
          }),
        ]);

        const inbound = await prisma.message.count({
          where: { direction: 'INBOUND', conversation: { businessId, customerId: customer.id } },
        });
        const outbound = messages - inbound;

        return {
          customerId: customer.id,
          businessId,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          firstSeenAt: customer.createdAt,
          lastSeenAt: customer.lastContactAt ?? customer.updatedAt,
          conversationCount: metric?.conversationCount ?? conversations,
          messagesSent: inbound,
          messagesReceived: outbound,
          inputTokens: (metric?.inputTokens ?? 0) + (events._sum.inputTokens ?? 0),
          outputTokens: (metric?.outputTokens ?? 0) + (events._sum.outputTokens ?? 0),
          totalTokens:
            (metric?.inputTokens ?? 0) +
            (metric?.outputTokens ?? 0) +
            (events._sum.inputTokens ?? 0) +
            (events._sum.outputTokens ?? 0),
          estimatedCostUsd:
            Number(metric?.estimatedCostUsd ?? 0) + Number(events._sum.estimatedCostUsd ?? 0),
          averageResponseTimeMs: Math.round(events._avg.latencyMs ?? metric?.avgResponseMs ?? 0),
          topQuestions: metric?.topQuestions ?? [],
          productsDiscussed: metric?.productsDiscussed ?? [],
          primaryLanguage: metric?.primaryLanguage,
          channel: metric?.primaryChannel ?? 'whatsapp',
        };
      })
    );
  }

  async listConversationsWithAnalytics(businessId: string, filters: AnalyticsFilters = {}) {
    const conversations = await prisma.conversation.findMany({
      where: {
        businessId,
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.conversationId ? { id: filters.conversationId } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
    });

    return Promise.all(
      conversations.map(async (conv) => {
        const [metric, events, firstMsg, lastMsg] = await Promise.all([
          prisma.aiConversationMetric.findUnique({ where: { conversationId: conv.id } }),
          prisma.aiUsageEvent.findMany({ where: { businessId, conversationId: conv.id } }),
          prisma.message.findFirst({
            where: { conversationId: conv.id },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
          }),
          prisma.message.findFirst({
            where: { conversationId: conv.id },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          }),
        ]);

        const inputTokens = events.reduce((s, e) => s + e.inputTokens, 0) || metric?.inputTokens || 0;
        const outputTokens = events.reduce((s, e) => s + e.outputTokens, 0) || metric?.outputTokens || 0;
        const promptChars = events.reduce((s, e) => s + e.promptChars, 0);
        const responseChars = events.reduce((s, e) => s + e.responseChars, 0);
        const retrievedChunks = events.reduce((s, e) => s + e.retrievedChunkCount, 0) || metric?.retrievedChunks || 0;
        const startedAt = firstMsg?.createdAt ?? conv.createdAt;
        const endedAt = conv.resolvedAt ?? lastMsg?.createdAt ?? null;
        const durationMs = endedAt ? endedAt.getTime() - startedAt.getTime() : null;
        const baseline = events.reduce((s, e) => s + e.baselineTokensEstimate, 0);
        const totalTokens = inputTokens + outputTokens;
        const compressionPercent =
          baseline > 0 ? Math.max(0, ((baseline - totalTokens) / baseline) * 100) : 0;

        return {
          conversationId: conv.id,
          businessId,
          customerId: conv.customerId,
          customerName: conv.customer.name,
          startedAt,
          endedAt,
          durationMs,
          messages: conv._count.messages,
          inputTokens,
          outputTokens,
          totalTokens,
          promptSize: promptChars,
          responseSize: responseChars,
          retrievedKnowledge: retrievedChunks,
          retrievedCategories: [
            ...new Set(events.flatMap((e) => e.retrievedCategories)),
            ...(metric?.categories ?? []),
          ],
          summaryGenerated: Boolean(conv.memorySummary) || metric?.summaryGenerated,
          compressionPercent,
          estimatedCostUsd: events.reduce((s, e) => s + Number(e.estimatedCostUsd ?? 0), 0),
          latencyMs: metric?.avgResponseMs ?? 0,
          aiProvider: events[0]?.provider ?? metric?.providers[0] ?? 'gemini',
          completionStatus: conv.resolutionMethod ?? conv.status,
          status: conv.status,
        };
      })
    );
  }
}

export const aiAnalyticsRepository = new AiAnalyticsRepository();
