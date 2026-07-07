import { prisma } from '../../infrastructure/database/prisma';
import { businessProfileService } from '../business-profile/business-profile.service';
import { knowledgeService } from '../knowledge/knowledge.service';
import { getGovernanceCapabilities } from '../governance/plan-capabilities.service';
import { workspaceService } from './workspace.service';
import { trainingJobService } from './training-job.service';
import { versionService } from './version.service';
import { deploymentService } from './deployment.service';
import { insightsService } from './insights.service';
import { aiTrainingAnalyticsService } from './analytics.service';
import { sandboxService } from './sandbox.service';

export class AiTrainingMgmtService {
  async getDashboard(businessId: string) {
    const [
      workspace,
      capabilities,
      profile,
      bases,
      jobs,
      versions,
      deploymentRequests,
      insights,
      analytics,
      auditLogs,
      pendingGovernance,
    ] = await Promise.all([
      workspaceService.ensureWorkspace(businessId),
      getGovernanceCapabilities(businessId),
      businessProfileService.get(businessId),
      knowledgeService.listBases(businessId),
      trainingJobService.listJobs(businessId, 10),
      versionService.listVersions(businessId),
      deploymentService.listRequests(businessId),
      insightsService.listInsights(businessId),
      aiTrainingAnalyticsService.getAnalytics(businessId),
      prisma.aiTrainingAuditLog.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: {
          user: { select: { firstName: true, lastName: true } },
          trainer: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.governanceApprovalRequest.findMany({
        where: { businessId, status: { in: ['PENDING', 'APPROVED'] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const baseId = bases[0]?.id;
    const documents = baseId
      ? await prisma.knowledgeDocument.findMany({
          where: { knowledgeBaseId: baseId },
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            fileSize: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        })
      : [];

    const faqs = baseId ? await knowledgeService.listFaqs(businessId, baseId) : [];
    const indexedCount = documents.filter((d) => d.status === 'INDEXED').length;
    const processingCount = documents.filter((d) =>
      ['UPLOADED', 'PROCESSING', 'INDEXING', 'PENDING'].includes(d.status)
    ).length;

    return {
      workspace: {
        id: workspace.id,
        productionVersion: workspace.productionVersion,
        sandboxVersion: workspace.sandboxVersion,
        lastTrainedAt: workspace.lastTrainedAt,
        aiReadinessScore: workspace.aiReadinessScore,
        knowledgeScore: workspace.knowledgeScore,
        confidenceScore: workspace.confidenceScore,
        embeddingCount: workspace.embeddingCount,
        documentCount: workspace.documentCount,
      },
      capabilities,
      businessProfile: profile,
      knowledgeBase: bases[0] ?? null,
      documents,
      faqs,
      syncStatus: {
        totalDocuments: documents.length,
        indexed: indexedCount,
        processing: processingCount,
        failed: documents.filter((d) => d.status === 'FAILED').length,
        embeddings: workspace.embeddingCount,
        lastUpdated: documents[0]?.updatedAt ?? profile.updatedAt,
      },
      trainingQueue: jobs.filter((j) => ['QUEUED', 'RUNNING'].includes(j.status)),
      retrainingQueue: jobs.filter((j) =>
        ['RETRAIN', 'INCREMENTAL_RETRAIN', 'PARTIAL_RETRAIN'].includes(j.type)
      ),
      recentJobs: jobs,
      versions: versions.filter((v: { status: string }) => v.status === 'PRODUCTION' || v.status === 'ARCHIVED'),
      deploymentRequests,
      insights,
      analytics,
      auditLogs,
      pendingGovernance,
      aiHealth: {
        status: (workspace.aiReadinessScore ?? 0) >= 70 ? 'healthy' : (workspace.aiReadinessScore ?? 0) >= 40 ? 'degraded' : 'critical',
        readinessScore: workspace.aiReadinessScore ?? 0,
        hasProduction: Boolean(workspace.productionVersionId),
        hasSandbox: Boolean(workspace.sandboxVersionId),
      },
    };
  }

  async getAuditLogs(businessId: string, limit = 50) {
    return prisma.aiTrainingAuditLog.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        trainer: { select: { firstName: true, lastName: true, username: true } },
        version: { select: { versionNumber: true } },
      },
    });
  }
}

export const aiTrainingMgmtService = new AiTrainingMgmtService();
