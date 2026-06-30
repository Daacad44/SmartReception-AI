import { prisma } from '../../../../infrastructure/database/prisma';
import { daysAgo } from '../../../ai-analytics/ai-analytics.repository';
import {
  allocatePlatformCost,
  buildCostResult,
  type CostProvider,
  type CostProviderContext,
} from '../cost-provider.interface';

export class AiCostProvider implements CostProvider {
  readonly key = 'AI';

  async calculate(ctx: CostProviderContext) {
    const since = ctx.since ?? daysAgo(30);

    const [usage, snapshot, training] = await Promise.all([
      prisma.aiUsageEvent.aggregate({
        where: { businessId: ctx.businessId, createdAt: { gte: since } },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          estimatedCostUsd: true,
          knowledgeChars: true,
          summaryChars: true,
        },
        _avg: { latencyMs: true },
        _count: { id: true },
      }),
      prisma.aiBusinessSnapshot.findUnique({ where: { businessId: ctx.businessId } }),
      prisma.aiTrainingSessionLog.aggregate({
        where: { businessId: ctx.businessId, createdAt: { gte: since } },
        _sum: { tokensUsed: true, estimatedCost: true },
        _count: { id: true },
      }),
    ]);

    const providerBreakdown = await prisma.aiUsageEvent.groupBy({
      by: ['provider'],
      where: { businessId: ctx.businessId, createdAt: { gte: since } },
      _sum: { inputTokens: true, outputTokens: true, totalTokens: true, estimatedCostUsd: true },
      _count: { id: true },
    });

    const monthlyFromEvents = Number(usage._sum.estimatedCostUsd ?? 0);
    const trainingCost = Number(training._sum.estimatedCost ?? 0);
    const monthlyCostUsd = monthlyFromEvents + trainingCost;

    const conversations = await prisma.conversation.count({
      where: { businessId: ctx.businessId },
    });
    const customers = await prisma.customer.count({
      where: { businessId: ctx.businessId, isActive: true },
    });

    return buildCostResult(this.key, monthlyCostUsd, {
      inputTokens: usage._sum.inputTokens ?? 0,
      outputTokens: usage._sum.outputTokens ?? 0,
      totalTokens: usage._sum.totalTokens ?? 0,
      knowledgeChars: usage._sum.knowledgeChars ?? 0,
      summaryChars: usage._sum.summaryChars ?? 0,
      requestCount: usage._count.id,
      trainingTokens: training._sum.tokensUsed ?? 0,
      trainingSessions: training._count.id,
      avgTokensPerRequest:
        usage._count.id > 0 ? (usage._sum.totalTokens ?? 0) / usage._count.id : 0,
      avgTokensPerConversation:
        conversations > 0 ? (usage._sum.totalTokens ?? 0) / conversations : 0,
      avgTokensPerCustomer: customers > 0 ? (usage._sum.totalTokens ?? 0) / customers : 0,
      costPerConversation: conversations > 0 ? monthlyCostUsd / conversations : 0,
      costPerCustomer: customers > 0 ? monthlyCostUsd / customers : 0,
      costPerToken:
        (usage._sum.totalTokens ?? 0) > 0
          ? monthlyCostUsd / (usage._sum.totalTokens ?? 1)
          : 0,
      lifetimeCostUsd: Number(snapshot?.lifetimeAiCost ?? monthlyCostUsd),
      providerBreakdown: providerBreakdown.map((row) => ({
        provider: row.provider,
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        totalTokens: row._sum.totalTokens ?? 0,
        costUsd: Number(row._sum.estimatedCostUsd ?? 0),
        requestCount: row._count.id,
      })),
    });
  }
}

export class WhatsAppCostProvider implements CostProvider {
  readonly key = 'WHATSAPP';

  async calculate(ctx: CostProviderContext) {
    const since = ctx.since ?? daysAgo(30);
    const where = {
      conversation: { businessId: ctx.businessId },
      direction: 'OUTBOUND' as const,
      createdAt: { gte: since },
    };

    const [templateCount, textCount, totalOutbound, delivered, failed, readCount] =
      await Promise.all([
        prisma.message.count({ where: { ...where, type: 'TEMPLATE' } }),
        prisma.message.count({ where: { ...where, type: 'TEXT' } }),
        prisma.message.count({ where }),
        prisma.message.count({ where: { ...where, status: 'DELIVERED' } }),
        prisma.message.count({ where: { ...where, status: 'FAILED' } }),
        prisma.message.count({ where: { ...where, status: 'READ' } }),
      ]);

    const marketingConversations = templateCount;
    const serviceConversations = textCount;
    const utilityConversations = await prisma.message.count({
      where: { ...where, type: { in: ['INTERACTIVE', 'DOCUMENT', 'IMAGE'] } },
    });
    const authConversations = 0;

    const monthlyCostUsd =
      authConversations * ctx.rates.whatsappAuth +
      marketingConversations * ctx.rates.whatsappMarketing +
      utilityConversations * ctx.rates.whatsappUtility +
      serviceConversations * ctx.rates.whatsappService;

    return buildCostResult(this.key, monthlyCostUsd, {
      authenticationConversations: authConversations,
      marketingConversations,
      utilityConversations,
      serviceConversations,
      conversationCount: totalOutbound,
      deliveredMessages: delivered,
      failedMessages: failed,
      readMessages: readCount,
      retryCount: failed,
    });
  }
}

export class EmailCostProvider implements CostProvider {
  readonly key = 'EMAIL';

  async calculate(ctx: CostProviderContext) {
    const since = ctx.since ?? daysAgo(30);

    const [appointmentEmails, subscriptionEmails] = await Promise.all([
      prisma.appointmentNotification.groupBy({
        by: ['status'],
        where: {
          businessId: ctx.businessId,
          channel: 'EMAIL',
          createdAt: { gte: since },
        },
        _count: { id: true },
      }),
      prisma.subscriptionNotification.groupBy({
        by: ['status'],
        where: {
          businessId: ctx.businessId,
          channel: 'EMAIL',
          createdAt: { gte: since },
        },
        _count: { id: true },
      }),
    ]);

    const countByStatus = (
      rows: Array<{ status: string; _count: { id: number } }>
    ) => Object.fromEntries(rows.map((r) => [r.status, r._count.id]));

    const appt = countByStatus(appointmentEmails);
    const sub = countByStatus(subscriptionEmails);

    const sent =
      (appt.SENT ?? 0) +
      (appt.DELIVERED ?? 0) +
      (appt.READ ?? 0) +
      (sub.SENT ?? 0);
    const delivered = (appt.DELIVERED ?? 0) + (appt.READ ?? 0) + (sub.SENT ?? 0);
    const failed = (appt.FAILED ?? 0) + (appt.BOUNCED ?? 0) + (sub.FAILED ?? 0);
    const total = Object.values(appt).reduce((a, b) => a + b, 0) +
      Object.values(sub).reduce((a, b) => a + b, 0);

    const monthlyCostUsd = total * ctx.rates.emailPerSend;

    return buildCostResult(this.key, monthlyCostUsd, {
      emailsSent: total,
      delivered,
      opened: 0,
      failed,
      attachments: 0,
      monthlyCostUsd,
    });
  }
}

export class StorageCostProvider implements CostProvider {
  readonly key = 'STORAGE';

  async calculate(ctx: CostProviderContext) {
    const [docs, messagesWithMedia, trainingFiles] = await Promise.all([
      prisma.knowledgeDocument.findMany({
        where: { knowledgeBase: { businessId: ctx.businessId } },
        select: { fileSize: true, type: true, title: true },
      }),
      prisma.message.findMany({
        where: {
          conversation: { businessId: ctx.businessId },
          mediaUrl: { not: null },
        },
        select: { mediaUrl: true, type: true },
      }),
      prisma.aiTrainingSessionLog.aggregate({
        where: { businessId: ctx.businessId },
        _sum: { documentsCount: true },
        _count: { _all: true },
      }),
    ]);

    const byType: Record<string, number> = {
      images: 0,
      documents: 0,
      pdf: 0,
      word: 0,
      excel: 0,
      voice: 0,
      video: 0,
      knowledgeBase: 0,
      training: 0,
      embeddings: 0,
    };

    for (const doc of docs) {
      const size = doc.fileSize ?? 0;
      byType.knowledgeBase += size;
      const title = (doc.title ?? '').toLowerCase();
      const type = String(doc.type).toLowerCase();
      if (title.endsWith('.pdf') || type.includes('pdf')) byType.pdf += size;
      else if (title.endsWith('.docx') || title.endsWith('.doc') || type.includes('word'))
        byType.word += size;
      else if (title.endsWith('.xlsx') || type.includes('sheet')) byType.excel += size;
      else if (type.includes('image')) byType.images += size;
      else byType.documents += size;
    }

    for (const msg of messagesWithMedia) {
      const type = msg.type.toLowerCase();
      if (type === 'image') byType.images += 500_000;
      else if (type === 'video') byType.video += 2_000_000;
      else if (type === 'audio') byType.voice += 300_000;
      else byType.documents += 200_000;
    }

    const totalBytes = Object.values(byType).reduce((a, b) => a + b, 0);
    const totalGb = totalBytes / (1024 * 1024 * 1024);
    const monthlyCostUsd = totalGb * ctx.rates.storagePerGbMonth;

    return buildCostResult(this.key, monthlyCostUsd, {
      ...byType,
      totalBytes,
      totalGb,
      storageGrowthGb: totalGb,
      trainingFiles: trainingFiles._count?._all ?? 0,
      documentsProcessed: trainingFiles._sum?.documentsCount ?? 0,
    });
  }
}

function platformAllocatedProvider(
  key: string,
  monthlyPlatformCost: number
): CostProvider {
  return {
    key,
    async calculate(ctx: CostProviderContext) {
      const monthlyCostUsd = allocatePlatformCost(
        monthlyPlatformCost,
        ctx.activeBusinessCount,
        ctx.allocationWeight ?? 1,
        ctx.allocationWeight ?? ctx.activeBusinessCount
      );
      return buildCostResult(key, monthlyCostUsd, {
        allocatedFromPlatformMonthly: monthlyPlatformCost,
        activeBusinesses: ctx.activeBusinessCount,
        allocationWeight: ctx.allocationWeight ?? 1,
      });
    },
  };
}

export class InfrastructureCostProvider implements CostProvider {
  readonly key = 'INFRASTRUCTURE';

  async calculate(ctx: CostProviderContext) {
    return platformAllocatedProvider(this.key, ctx.rates.infrastructureMonthly).calculate(ctx);
  }
}

export class DatabaseCostProvider implements CostProvider {
  readonly key = 'DATABASE';

  async calculate(ctx: CostProviderContext) {
    const [rowCounts] = await Promise.all([
      prisma.$queryRaw<Array<{ total_rows: bigint }>>`
        SELECT
          (SELECT COUNT(*) FROM messages m JOIN conversations c ON c.id = m."conversationId" WHERE c."businessId" = ${ctx.businessId}) +
          (SELECT COUNT(*) FROM customers WHERE "businessId" = ${ctx.businessId}) +
          (SELECT COUNT(*) FROM conversations WHERE "businessId" = ${ctx.businessId}) AS total_rows
      `,
    ]);

    const result = await platformAllocatedProvider(this.key, ctx.rates.databaseMonthly).calculate(
      ctx
    );
    result.breakdown = {
      ...result.breakdown,
      estimatedRows: Number(rowCounts[0]?.total_rows ?? 0),
    };
    return result;
  }
}

export class RedisCostProvider implements CostProvider {
  readonly key = 'REDIS';
  async calculate(ctx: CostProviderContext) {
    return platformAllocatedProvider(this.key, ctx.rates.redisMonthly).calculate(ctx);
  }
}

export class MonitoringCostProvider implements CostProvider {
  readonly key = 'MONITORING';
  async calculate(ctx: CostProviderContext) {
    const auditCount = await prisma.auditLog.count({
      where: { businessId: ctx.businessId },
    });
    const result = await platformAllocatedProvider(this.key, ctx.rates.monitoringMonthly).calculate(
      ctx
    );
    result.breakdown = { ...result.breakdown, auditLogCount: auditCount };
    return result;
  }
}

export class BackupCostProvider implements CostProvider {
  readonly key = 'BACKUP';
  async calculate(ctx: CostProviderContext) {
    const docBytes = await prisma.knowledgeDocument.aggregate({
      where: { knowledgeBase: { businessId: ctx.businessId } },
      _sum: { fileSize: true },
    });
    const backupGb = (docBytes._sum.fileSize ?? 0) / (1024 * 1024 * 1024);
    const result = await platformAllocatedProvider(this.key, ctx.rates.backupMonthly).calculate(ctx);
    result.breakdown = {
      ...result.breakdown,
      backupSizeGb: backupGb,
      retentionDays: 30,
    };
    return result;
  }
}
