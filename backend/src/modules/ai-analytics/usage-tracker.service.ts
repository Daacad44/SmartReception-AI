import { prisma } from '../../infrastructure/database/prisma';
import { estimateCostUsd, type AiProviderName } from '../../infrastructure/ai/providers/types';

export interface UsageEventInput {
  businessId: string;
  conversationId?: string;
  customerId?: string;
  messageId?: string;
  provider: string;
  model: string;
  operation: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs?: number;
  promptChars?: number;
  responseChars?: number;
  retrievedChunkCount?: number;
  retrievedCategories?: string[];
  intent?: string;
  route?: string;
  usedRag?: boolean;
  usedSummary?: boolean;
  summaryChars?: number;
  knowledgeChars?: number;
  baselineTokensEstimate?: number;
  tokenSavingsPercent?: number;
  fallbackUsed?: boolean;
  success?: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

class UsageTrackerService {
  async record(input: UsageEventInput): Promise<void> {
    const totalTokens = input.inputTokens + input.outputTokens;
    const estimatedCostUsd = estimateCostUsd(
      (input.provider as AiProviderName) || 'gemini',
      input.inputTokens,
      input.outputTokens
    );

    const tokenSavingsPercent =
      input.tokenSavingsPercent ??
      (input.baselineTokensEstimate && input.baselineTokensEstimate > 0
        ? Math.max(0, ((input.baselineTokensEstimate - totalTokens) / input.baselineTokensEstimate) * 100)
        : 0);

    await prisma.aiUsageEvent.create({
      data: {
        businessId: input.businessId,
        conversationId: input.conversationId,
        customerId: input.customerId,
        messageId: input.messageId,
        provider: input.provider,
        model: input.model,
        operation: input.operation,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        totalTokens,
        estimatedCostUsd,
        latencyMs: input.latencyMs,
        promptChars: input.promptChars ?? 0,
        responseChars: input.responseChars ?? 0,
        retrievedChunkCount: input.retrievedChunkCount ?? 0,
        retrievedCategories: input.retrievedCategories ?? [],
        intent: input.intent,
        route: input.route,
        usedRag: input.usedRag ?? false,
        usedSummary: input.usedSummary ?? false,
        summaryChars: input.summaryChars ?? 0,
        knowledgeChars: input.knowledgeChars ?? 0,
        baselineTokensEstimate: input.baselineTokensEstimate ?? 0,
        tokenSavingsPercent,
        fallbackUsed: input.fallbackUsed ?? false,
        success: input.success ?? true,
        errorMessage: input.errorMessage,
        metadata: input.metadata as object | undefined,
      },
    });

    void this.updateRollups(input, totalTokens, Number(estimatedCostUsd), tokenSavingsPercent).catch(
      () => undefined
    );
    void import('./business-snapshot.service').then(({ businessSnapshotService }) =>
      businessSnapshotService.refresh(input.businessId)
    );
  }

  private async updateRollups(
    input: UsageEventInput,
    totalTokens: number,
    costUsd: number,
    tokenSavingsPercent: number
  ) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const savingsTokens = Math.max(0, (input.baselineTokensEstimate ?? 0) - totalTokens);

    await prisma.aiDailyRollup.upsert({
      where: { businessId_date: { businessId: input.businessId, date: today } },
      create: {
        businessId: input.businessId,
        date: today,
        totalRequests: 1,
        totalConversations: input.conversationId ? 1 : 0,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        totalTokens,
        estimatedCostUsd: costUsd,
        avgLatencyMs: input.latencyMs ?? 0,
        retrievedChunks: input.retrievedChunkCount ?? 0,
        avgRetrievedChunks: input.retrievedChunkCount ?? 0,
        tokenSavingsTokens: savingsTokens,
        tokenSavingsPercent,
        fallbackCount: input.fallbackUsed ? 1 : 0,
        providerBreakdown: { [input.provider]: 1 },
      },
      update: {
        totalRequests: { increment: 1 },
        inputTokens: { increment: input.inputTokens },
        outputTokens: { increment: input.outputTokens },
        totalTokens: { increment: totalTokens },
        estimatedCostUsd: { increment: costUsd },
        retrievedChunks: { increment: input.retrievedChunkCount ?? 0 },
        tokenSavingsTokens: { increment: savingsTokens },
        fallbackCount: input.fallbackUsed ? { increment: 1 } : undefined,
      },
    });

    if (input.conversationId) {
      await prisma.aiConversationMetric.upsert({
        where: { conversationId: input.conversationId },
        create: {
          businessId: input.businessId,
          conversationId: input.conversationId,
          customerId: input.customerId,
          startedAt: new Date(),
          messageCount: 1,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          totalTokens,
          estimatedCostUsd: costUsd,
          retrievedChunks: input.retrievedChunkCount ?? 0,
          categories: input.retrievedCategories ?? [],
          providers: [input.provider],
          summaryGenerated: input.usedSummary ?? false,
          avgResponseMs: input.latencyMs,
        },
        update: {
          messageCount: { increment: 1 },
          inputTokens: { increment: input.inputTokens },
          outputTokens: { increment: input.outputTokens },
          totalTokens: { increment: totalTokens },
          estimatedCostUsd: { increment: costUsd },
          retrievedChunks: { increment: input.retrievedChunkCount ?? 0 },
          summaryGenerated: input.usedSummary ? true : undefined,
        },
      });
    }

    if (input.customerId) {
      const now = new Date();
      await prisma.aiCustomerMetric.upsert({
        where: {
          businessId_customerId: { businessId: input.businessId, customerId: input.customerId },
        },
        create: {
          businessId: input.businessId,
          customerId: input.customerId,
          firstSeenAt: now,
          lastSeenAt: now,
          conversationCount: input.conversationId ? 1 : 0,
          messageCount: 1,
          inputTokens: input.inputTokens,
          outputTokens: input.outputTokens,
          estimatedCostUsd: costUsd,
          topQuestions: input.intent ? [input.intent] : [],
          avgResponseMs: input.latencyMs,
          primaryLanguage: input.intent,
        },
        update: {
          lastSeenAt: now,
          messageCount: { increment: 1 },
          inputTokens: { increment: input.inputTokens },
          outputTokens: { increment: input.outputTokens },
          estimatedCostUsd: { increment: costUsd },
        },
      });
    }
  }
}

export const aiUsageTracker = new UsageTrackerService();
