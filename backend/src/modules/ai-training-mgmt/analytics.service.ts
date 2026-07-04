import { prisma } from '../../infrastructure/database/prisma';

export class AiTrainingAnalyticsService {
  async getAnalytics(businessId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalConversations,
      aiHandled,
      humanHandover,
      messages,
      workspace,
      insights,
      trainingJobs,
      documents,
    ] = await Promise.all([
      prisma.conversation.count({ where: { businessId, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.conversation.count({
        where: { businessId, isAiEnabled: true, status: { notIn: ['HUMAN_HANDLING', 'HUMAN_NEEDED'] }, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.conversation.count({
        where: { businessId, status: { in: ['HUMAN_HANDLING', 'HUMAN_NEEDED'] }, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.message.findMany({
        where: { conversation: { businessId }, createdAt: { gte: thirtyDaysAgo }, direction: 'OUTBOUND' },
        select: { isAiGenerated: true, createdAt: true },
      }),
      prisma.aiTrainingWorkspace.findUnique({ where: { businessId } }),
      prisma.aiTrainingInsight.count({ where: { businessId, resolvedAt: null } }),
      prisma.aiTrainingJob.count({
        where: { businessId, type: { in: ['FULL_TRAIN', 'RETRAIN', 'INCREMENTAL_RETRAIN'] }, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.knowledgeDocument.count({ where: { knowledgeBase: { businessId } } }),
    ]);

    const aiMessages = messages.filter((m) => m.isAiGenerated).length;
    const humanMessages = messages.length - aiMessages;
    const aiResolutionRate = totalConversations > 0 ? Math.round((aiHandled / totalConversations) * 100) : 0;
    const humanHandoverRate = totalConversations > 0 ? Math.round((humanHandover / totalConversations) * 100) : 0;

    const failedQuestions = await prisma.aiSandboxMessage.count({
      where: {
        missingKnowledge: true,
        session: { businessId },
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const versions = await prisma.aiTrainingVersion.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { versionNumber: true, readinessScore: true, createdAt: true },
    });

    return {
      period: '30d',
      conversations: {
        total: totalConversations,
        aiHandled,
        humanHandover,
        aiResolutionRate,
        humanHandoverRate,
      },
      messages: {
        ai: aiMessages,
        human: humanMessages,
      },
      knowledge: {
        documentCount: documents,
        embeddingCount: workspace?.embeddingCount ?? 0,
        knowledgeScore: workspace?.knowledgeScore ?? 0,
        openInsights: insights,
      },
      training: {
        retrainingFrequency: trainingJobs,
        versions,
        lastTrainedAt: workspace?.lastTrainedAt,
      },
      quality: {
        aiReadinessScore: workspace?.aiReadinessScore ?? 0,
        confidenceScore: workspace?.confidenceScore ?? 0,
        failedQuestions,
      },
      usage: {
        estimatedTokens: aiMessages * 350,
        embeddingUsage: workspace?.embeddingCount ?? 0,
      },
    };
  }
}

export const aiTrainingAnalyticsService = new AiTrainingAnalyticsService();
