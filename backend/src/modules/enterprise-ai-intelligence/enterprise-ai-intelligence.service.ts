import { prisma } from '../../infrastructure/database/prisma';
import { aiTrainingMgmtService } from '../ai-training-mgmt/ai-training-mgmt.service';
import { trainingCenterService } from '../ai-training-mgmt/training-center.service';
import { trainingSessionLogService } from '../ai-training-mgmt/training-session-log.service';
import { sandboxService } from '../ai-training-mgmt/sandbox.service';
import { deploymentService } from '../ai-training-mgmt/deployment.service';
import { trainingEngineService } from '../ai-training-mgmt/training-engine.service';

import { NO_KNOWLEDGE_REPLY } from '../ai-training-mgmt/ai-knowledge.constants';

export class EnterpriseAiIntelligenceService {
  async getTenantDashboard(businessId: string) {
    const dashboard = await aiTrainingMgmtService.getDashboard(businessId);
    return {
      ...dashboard,
      mandatoryAiRule: {
        noHallucination: true,
        noAssumptions: true,
        noExternalKnowledge: true,
        fallbackMessage: NO_KNOWLEDGE_REPLY,
      },
    };
  }

  async getPlatformOverview() {
    const [overview, jobStats, deploymentStats, validationStats] = await Promise.all([
      trainingCenterService.getPlatformOverview(),
      this.getJobMonitoring(),
      this.getDeploymentMonitoring(),
      this.getValidationMonitoring(),
    ]);

    return {
      ...overview,
      monitoring: {
        jobs: jobStats,
        deployments: deploymentStats,
        validation: validationStats,
      },
    };
  }

  async listBusinesses(page = 1, limit = 50, search?: string) {
    const result = await trainingCenterService.listBusinessCards(page, limit, search);
    const enriched = result.data.map((card) => ({
      ...card,
      policies: 0,
      deploymentStatus: card.productionVersionId ? 'DEPLOYED' : 'NOT_DEPLOYED',
      validationScore: card.trainingHealthScore,
      trainingProgress:
        card.trainingStatus === 'IN_PROGRESS'
          ? 50
          : card.trainingStatus === 'COMPLETED' || card.productionVersionId
            ? 100
            : 0,
      embeddingProvider: card.aiVersion ?? 'gemini-embedding-001',
      modelProvider: card.currentAiProvider ?? 'gemini',
    }));
    return { data: enriched, meta: result.meta };
  }

  async getBusinessDetail(businessId: string) {
    const detail = await trainingCenterService.getBusinessDetail(businessId);
    if (!detail) return null;

    const [deployments, sandboxSessions] = await Promise.all([
      deploymentService.listRequests(businessId),
      sandboxService.listSessions(businessId),
    ]);

    const latestValidation = detail.sessions?.find(
      (s: { validationResult?: unknown }) => s.validationResult
    );

    return {
      ...detail,
      deploymentStatus: detail.productionVersionId ? 'DEPLOYED' : 'NOT_DEPLOYED',
      deployments,
      sandboxSessions,
      validationReport: latestValidation?.validationResult ?? null,
      uploadCenter: {
        supportedFormats: [
          'PDF',
          'Word',
          'Excel',
          'CSV',
          'TXT',
          'Markdown',
          'Images',
          'Knowledge Files',
          'Policy Files',
          'FAQ Files',
          'Service Lists',
          'Product Catalogues',
          'Pricing Documents',
          'Company Documents',
        ],
        businessIsolation: true,
      },
      mandatoryAiRule: {
        noHallucination: true,
        fallbackMessage: NO_KNOWLEDGE_REPLY,
      },
    };
  }

  async getMonitoring(filters?: { businessId?: string; limit?: number }) {
    const limit = filters?.limit ?? 50;
    const businessId = filters?.businessId;

    const [jobs, sessions, deployments, uploadHistory, knowledgeGrowth] = await Promise.all([
      prisma.aiTrainingJob.findMany({
        where: businessId ? { businessId } : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          business: { select: { id: true, name: true } },
          version: { select: { versionNumber: true, status: true } },
        },
      }),
      trainingSessionLogService.listSessions({ businessId, limit }),
      prisma.aiDeploymentRequest.findMany({
        where: businessId ? { businessId } : undefined,
        orderBy: { requestedAt: 'desc' },
        take: limit,
        include: {
          business: { select: { id: true, name: true } },
          version: { select: { versionNumber: true } },
        },
      }),
      this.getUploadHistory(businessId, limit),
      this.getKnowledgeGrowth(businessId),
    ]);

    const costSummary = await this.getCostSummary(businessId);

    return {
      trainingJobs: jobs,
      embeddingJobs: jobs.filter((j) => j.type === 'EMBED_DOCUMENTS'),
      validationJobs: jobs.filter((j) => j.type === 'EVALUATE'),
      deploymentJobs: deployments,
      failures: jobs.filter((j) => j.status === 'FAILED'),
      warnings: sessions.data.filter((s) => (s.warnings as string[] | null)?.length),
      retrainingHistory: jobs.filter((j) =>
        ['RETRAIN', 'INCREMENTAL_RETRAIN', 'PARTIAL_RETRAIN'].includes(j.type)
      ),
      uploadHistory,
      knowledgeGrowth,
      costSummary,
      sessions: sessions.data,
    };
  }

  async getValidationReport(businessId: string, sessionId?: string) {
    if (sessionId) {
      const session = await trainingSessionLogService.getSession(sessionId);
      if (!session || session.businessId !== businessId) return null;
      return session.validationResult;
    }

    const sessions = await trainingSessionLogService.listSessions({ businessId, limit: 1 });
    const latest = sessions.data.find((s) => s.validationResult);
    return latest?.validationResult ?? null;
  }

  async createPlaygroundSession(
    businessId: string,
    versionId: string,
    opts: { userId?: string; label?: string }
  ) {
    return sandboxService.createSession(businessId, versionId, opts);
  }

  async sendPlaygroundMessage(
    businessId: string,
    sessionId: string,
    content: string,
    userId?: string
  ) {
    return sandboxService.sendMessage(businessId, sessionId, content, { userId });
  }

  private async getJobMonitoring() {
    const [queued, running, failed, completed] = await Promise.all([
      prisma.aiTrainingJob.count({ where: { status: 'QUEUED' } }),
      prisma.aiTrainingJob.count({ where: { status: 'RUNNING' } }),
      prisma.aiTrainingJob.count({ where: { status: 'FAILED' } }),
      prisma.aiTrainingJob.count({
        where: { status: 'COMPLETED', completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ]);
    return { queued, running, failed, completedLast24h: completed };
  }

  private async getDeploymentMonitoring() {
    const [pending, deployed, rejected] = await Promise.all([
      prisma.aiDeploymentRequest.count({ where: { status: 'PENDING' } }),
      prisma.aiDeploymentRequest.count({ where: { status: 'DEPLOYED' } }),
      prisma.aiDeploymentRequest.count({ where: { status: 'REJECTED' } }),
    ]);
    return { pending, deployed, rejected };
  }

  private async getValidationMonitoring() {
    const recent = await prisma.aiTrainingSessionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { status: true, qualityScore: true, validationResult: true },
    });
    const withValidation = recent.filter((s) => s.validationResult != null);
    const passed = withValidation.filter((s) => s.status === 'COMPLETED').length;
    const failed = withValidation.filter((s) => s.status === 'FAILED').length;
    const avgScore =
      withValidation.length > 0
        ? withValidation.reduce((sum, s) => sum + (s.qualityScore ?? 0), 0) / withValidation.length
        : 0;
    return { passed, failed, avgScore: Math.round(avgScore) };
  }

  private async getUploadHistory(businessId?: string, limit = 50) {
    return prisma.knowledgeDocument.findMany({
      where: businessId
        ? { knowledgeBase: { businessId } }
        : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        category: true,
        fileSize: true,
        createdAt: true,
        knowledgeBase: { select: { businessId: true, business: { select: { name: true } } } },
      },
    });
  }

  private async getKnowledgeGrowth(businessId?: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const docs = await prisma.knowledgeDocument.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: thirtyDaysAgo },
        ...(businessId ? { knowledgeBase: { businessId } } : {}),
      },
      _count: true,
    });
    const chunks = await prisma.knowledgeChunk.count({
      where: {
        isActive: true,
        ...(businessId ? { businessId } : {}),
      },
    });
    return { documentsByStatus: docs, totalChunks: chunks };
  }

  private async getCostSummary(businessId?: string) {
    const sessions = await prisma.aiTrainingSessionLog.aggregate({
      where: businessId ? { businessId } : undefined,
      _sum: { estimatedCost: true, tokensUsed: true },
    });
    return {
      trainingCost: Number(sessions._sum.estimatedCost ?? 0),
      trainingTokens: sessions._sum.tokensUsed ?? 0,
      estimatedEmbeddingCost: trainingEngineService.estimateTrainingCost(0, 0),
    };
  }
}

export const enterpriseAiIntelligenceService = new EnterpriseAiIntelligenceService();
export { NO_KNOWLEDGE_REPLY } from '../ai-training-mgmt/ai-knowledge.constants';
