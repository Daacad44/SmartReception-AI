import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../core/logger';
import { aiAnalyticsRepository, estimateTokensFromText, daysAgo } from './ai-analytics.repository';
import { businessSnapshotService } from './business-snapshot.service';
import { estimateCostUsd } from '../../infrastructure/ai/providers/types';

export class HistoricalBackfillService {
  private running = false;

  async backfillAll(): Promise<{ businesses: number }> {
    if (this.running) return { businesses: 0 };
    this.running = true;

    try {
      const businesses = await prisma.business.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      for (const { id } of businesses) {
        await this.backfillBusiness(id);
      }

      logger.info('AI analytics historical backfill completed', { businesses: businesses.length });
      return { businesses: businesses.length };
    } finally {
      this.running = false;
    }
  }

  async backfillBusiness(businessId: string): Promise<void> {
    await this.backfillCustomerMetrics(businessId);
    await this.backfillConversationMetrics(businessId);
    await this.backfillDailyRollups(businessId);
    await businessSnapshotService.refresh(businessId);

    await prisma.aiBusinessSnapshot.update({
      where: { businessId },
      data: { backfilledAt: new Date() },
    }).catch(() => undefined);
  }

  private async backfillCustomerMetrics(businessId: string) {
    const customers = await prisma.customer.findMany({
      where: { businessId },
      select: { id: true, createdAt: true, lastContactAt: true },
    });

    for (const customer of customers) {
      const conversations = await prisma.conversation.findMany({
        where: { businessId, customerId: customer.id },
        select: { id: true },
      });
      const convIds = conversations.map((c) => c.id);
      if (!convIds.length) continue;

      const messages = await prisma.message.findMany({
        where: { conversationId: { in: convIds } },
        select: { content: true, isAiGenerated: true, direction: true, createdAt: true },
      });

      let inputTokens = 0;
      let outputTokens = 0;
      for (const msg of messages) {
        const tokens = estimateTokensFromText(msg.content);
        if (msg.isAiGenerated) outputTokens += tokens;
        else if (msg.direction === 'INBOUND') inputTokens += tokens;
      }

      const events = await prisma.aiUsageEvent.aggregate({
        where: { businessId, customerId: customer.id },
        _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
        _avg: { latencyMs: true },
      });

      await prisma.aiCustomerMetric.upsert({
        where: { businessId_customerId: { businessId, customerId: customer.id } },
        create: {
          businessId,
          customerId: customer.id,
          firstSeenAt: customer.createdAt,
          lastSeenAt: customer.lastContactAt ?? customer.createdAt,
          conversationCount: conversations.length,
          messageCount: messages.length,
          inputTokens: inputTokens + (events._sum.inputTokens ?? 0),
          outputTokens: outputTokens + (events._sum.outputTokens ?? 0),
          estimatedCostUsd:
            Number(events._sum.estimatedCostUsd ?? 0) ||
            estimateCostUsd('gemini', inputTokens, outputTokens),
          avgResponseMs: Math.round(events._avg.latencyMs ?? 0),
          primaryChannel: 'whatsapp',
        },
        update: {
          conversationCount: conversations.length,
          messageCount: messages.length,
          lastSeenAt: customer.lastContactAt ?? customer.createdAt,
        },
      });
    }
  }

  private async backfillConversationMetrics(businessId: string) {
    const conversations = await prisma.conversation.findMany({
      where: { businessId },
      select: { id: true, customerId: true, createdAt: true, resolvedAt: true, memorySummary: true },
    });

    for (const conv of conversations) {
      const messages = await prisma.message.findMany({
        where: { conversationId: conv.id },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      const events = await prisma.aiUsageEvent.findMany({
        where: { businessId, conversationId: conv.id },
      });

      const inputTokens = events.reduce((s, e) => s + e.inputTokens, 0);
      const outputTokens = events.reduce((s, e) => s + e.outputTokens, 0);
      const cost = events.reduce((s, e) => s + Number(e.estimatedCostUsd ?? 0), 0);

      await prisma.aiConversationMetric.upsert({
        where: { conversationId: conv.id },
        create: {
          businessId,
          conversationId: conv.id,
          customerId: conv.customerId,
          startedAt: messages[0]?.createdAt ?? conv.createdAt,
          endedAt: conv.resolvedAt,
          messageCount: messages.length,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          estimatedCostUsd: cost,
          retrievedChunks: events.reduce((s, e) => s + e.retrievedChunkCount, 0),
          categories: [...new Set(events.flatMap((e) => e.retrievedCategories))],
          providers: [...new Set(events.map((e) => e.provider))],
          summaryGenerated: Boolean(conv.memorySummary),
          avgResponseMs: events.length
            ? Math.round(events.reduce((s, e) => s + (e.latencyMs ?? 0), 0) / events.length)
            : null,
        },
        update: {
          messageCount: messages.length,
          endedAt: conv.resolvedAt,
          summaryGenerated: Boolean(conv.memorySummary),
        },
      });
    }
  }

  private async backfillDailyRollups(businessId: string) {
    const since = daysAgo(365);
    const rows = await prisma.$queryRaw<
      Array<{ day: Date; inbound: bigint; ai_out: bigint; chars: bigint }>
    >`
      SELECT DATE(m."createdAt") AS day,
             COUNT(*) FILTER (WHERE m."direction" = 'INBOUND')::bigint AS inbound,
             COUNT(*) FILTER (WHERE m."isAiGenerated" = true)::bigint AS ai_out,
             SUM(LENGTH(m."content"))::bigint AS chars
      FROM "messages" m
      JOIN "conversations" c ON c."id" = m."conversationId"
      WHERE c."businessId" = ${businessId}
        AND m."createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `;

    for (const row of rows) {
      const estimatedTokens = Math.ceil(Number(row.chars) / 4);
      const inputTokens = Math.ceil(estimatedTokens * 0.55);
      const outputTokens = estimatedTokens - inputTokens;
      const cost = estimateCostUsd('gemini', inputTokens, outputTokens);

      await prisma.aiDailyRollup.upsert({
        where: { businessId_date: { businessId, date: row.day } },
        create: {
          businessId,
          date: row.day,
          totalRequests: Number(row.ai_out),
          totalConversations: Number(row.inbound),
          inputTokens,
          outputTokens,
          totalTokens: estimatedTokens,
          estimatedCostUsd: cost,
        },
        update: {},
      });
    }
  }
}

export const historicalBackfillService = new HistoricalBackfillService();
