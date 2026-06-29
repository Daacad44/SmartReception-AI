import { prisma } from '../../infrastructure/database/prisma';
import type { AiBusinessSnapshot } from '@prisma/client';
import { aiAnalyticsRepository, startOfDay, daysAgo } from './ai-analytics.repository';
import { broadcastAiAnalyticsUpdate } from '../../infrastructure/realtime/broadcast.service';

const SNAPSHOT_STALE_MS = 60_000;
const refreshInFlight = new Map<string, Promise<void>>();

export class BusinessSnapshotService {
  /**
   * Fast read path: return cached snapshot immediately.
   * Refresh in background when stale; block only when no snapshot exists yet.
   */
  async getSnapshotForRead(businessId: string): Promise<AiBusinessSnapshot | null> {
    const existing = await prisma.aiBusinessSnapshot.findUnique({ where: { businessId } });

    if (!existing) {
      await this.refresh(businessId);
      return prisma.aiBusinessSnapshot.findUnique({ where: { businessId } });
    }

    const ageMs = Date.now() - existing.updatedAt.getTime();
    if (ageMs > SNAPSHOT_STALE_MS) {
      void this.refreshDeduped(businessId).catch(() => undefined);
    }

    return existing;
  }

  async refreshDeduped(businessId: string): Promise<void> {
    const pending = refreshInFlight.get(businessId);
    if (pending) return pending;

    const job = this.refresh(businessId).finally(() => {
      refreshInFlight.delete(businessId);
    });
    refreshInFlight.set(businessId, job);
    return job;
  }

  async refresh(businessId: string): Promise<void> {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekAgo = daysAgo(7);
    const monthAgo = daysAgo(30);

    const [
      customers,
      conversationCount,
      messageStats,
      lifetimeTokens,
      dailyTokens,
      weeklyTokens,
      monthlyTokens,
      training,
      automationRate,
      topProvider,
      lastActivity,
    ] = await Promise.all([
      aiAnalyticsRepository.computeCustomerCounts(businessId),
      prisma.conversation.count({ where: { businessId } }),
      aiAnalyticsRepository.computeMessageStats(businessId),
      aiAnalyticsRepository.computeMergedTokenStats(businessId),
      aiAnalyticsRepository.computeMergedTokenStats(businessId, todayStart),
      aiAnalyticsRepository.computeMergedTokenStats(businessId, weekAgo),
      aiAnalyticsRepository.computeMergedTokenStats(businessId, monthAgo),
      aiAnalyticsRepository.computeTrainingInfo(businessId),
      aiAnalyticsRepository.computeAutomationSuccessRate(businessId),
      aiAnalyticsRepository.getTopProvider(businessId, monthAgo),
      aiAnalyticsRepository.getLastActivity(businessId),
    ]);

    const avgTokensPerConversation =
      conversationCount > 0 ? lifetimeTokens.totalTokens / conversationCount : 0;
    const avgTokensPerCustomer =
      customers.total > 0 ? lifetimeTokens.totalTokens / customers.total : 0;

    await prisma.aiBusinessSnapshot.upsert({
      where: { businessId },
      create: {
        businessId,
        totalCustomers: customers.total,
        activeCustomers: customers.active,
        returningCustomers: customers.returning,
        totalConversations: conversationCount,
        totalCustomerMessages: messageStats.inbound,
        totalAiMessages: messageStats.outboundAi,
        inputTokens: lifetimeTokens.inputTokens,
        outputTokens: lifetimeTokens.outputTokens,
        totalTokens: lifetimeTokens.totalTokens,
        dailyTokens: dailyTokens.totalTokens,
        weeklyTokens: weeklyTokens.totalTokens,
        monthlyTokens: monthlyTokens.totalTokens,
        lifetimeTokens: lifetimeTokens.totalTokens,
        estimatedAiCost: dailyTokens.estimatedCostUsd,
        monthlyAiCost: monthlyTokens.estimatedCostUsd,
        lifetimeAiCost: lifetimeTokens.estimatedCostUsd,
        avgTokensPerConversation,
        avgTokensPerCustomer,
        avgResponseTimeMs: lifetimeTokens.avgLatencyMs,
        topProvider,
        knowledgeBaseSize: training.knowledgeBaseSize,
        trainingStatus: training.trainingStatus,
        lastTrainingAt: training.lastTrainingAt,
        healthScore: training.healthScore,
        automationSuccessRate: automationRate,
        tokenSavingsPercent: lifetimeTokens.tokenSavingsPercent,
        tokenSavingsTokens: lifetimeTokens.tokenSavingsTokens,
        lastActivityAt: lastActivity,
        updatedAt: now,
      },
      update: {
        totalCustomers: customers.total,
        activeCustomers: customers.active,
        returningCustomers: customers.returning,
        totalConversations: conversationCount,
        totalCustomerMessages: messageStats.inbound,
        totalAiMessages: messageStats.outboundAi,
        inputTokens: lifetimeTokens.inputTokens,
        outputTokens: lifetimeTokens.outputTokens,
        totalTokens: lifetimeTokens.totalTokens,
        dailyTokens: dailyTokens.totalTokens,
        weeklyTokens: weeklyTokens.totalTokens,
        monthlyTokens: monthlyTokens.totalTokens,
        lifetimeTokens: lifetimeTokens.totalTokens,
        estimatedAiCost: dailyTokens.estimatedCostUsd,
        monthlyAiCost: monthlyTokens.estimatedCostUsd,
        lifetimeAiCost: lifetimeTokens.estimatedCostUsd,
        avgTokensPerConversation,
        avgTokensPerCustomer,
        avgResponseTimeMs: lifetimeTokens.avgLatencyMs,
        topProvider,
        knowledgeBaseSize: training.knowledgeBaseSize,
        trainingStatus: training.trainingStatus,
        lastTrainingAt: training.lastTrainingAt,
        healthScore: training.healthScore,
        automationSuccessRate: automationRate,
        tokenSavingsPercent: lifetimeTokens.tokenSavingsPercent,
        tokenSavingsTokens: lifetimeTokens.tokenSavingsTokens,
        lastActivityAt: lastActivity,
        updatedAt: now,
      },
    });

    void broadcastAiAnalyticsUpdate(businessId).catch(() => undefined);
  }
}

export const businessSnapshotService = new BusinessSnapshotService();
