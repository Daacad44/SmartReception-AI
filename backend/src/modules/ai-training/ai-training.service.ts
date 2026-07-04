import { prisma } from '../../infrastructure/database/prisma';
import { knowledgeService } from '../knowledge/knowledge.service';
import { businessProfileService } from '../business-profile/business-profile.service';
import { getGovernanceCapabilities } from '../governance/plan-capabilities.service';

export class AiTrainingService {
  async getOverview(businessId: string) {
    const [profile, bases, capabilities, pendingRequests] = await Promise.all([
      businessProfileService.get(businessId),
      knowledgeService.listBases(businessId),
      getGovernanceCapabilities(businessId),
      prisma.governanceApprovalRequest.findMany({
        where: {
          businessId,
          status: { in: ['PENDING', 'APPROVED'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          actionType: true,
          status: true,
          createdAt: true,
          approvedAt: true,
          activationCodeExpiresAt: true,
        },
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
    const failedCount = documents.filter((d) => d.status === 'FAILED').length;

    const embeddingsCount = await prisma.knowledgeDocument.count({
      where: {
        knowledgeBase: { businessId },
        embedding: { not: null },
      },
    });

    return {
      capabilities,
      businessProfile: profile,
      knowledgeBase: bases[0] ?? null,
      documents,
      faqs,
      syncStatus: {
        totalDocuments: documents.length,
        indexed: indexedCount,
        processing: processingCount,
        failed: failedCount,
        embeddings: embeddingsCount,
        lastUpdated: documents[0]?.updatedAt ?? profile.updatedAt,
      },
      pendingApprovals: pendingRequests,
    };
  }

  async reindex(businessId: string, userId: string, isSuperAdmin: boolean) {
    const { governanceService } = await import('../governance/governance.service');
    const guard = await governanceService.guardAction(
      { businessId, userId, isSuperAdmin },
      { actionType: 'AI_REINDEX', payload: {} }
    );
    if (!guard.proceed) {
      return { approvalRequired: true as const, request: guard.request };
    }
    const documents = await prisma.knowledgeDocument.findMany({
      where: { knowledgeBase: { businessId } },
      select: { id: true },
    });
    for (const doc of documents) {
      await knowledgeService.processDocument(businessId, doc.id);
    }
    return { approvalRequired: false as const, reindexed: documents.length };
  }

  async resetMemory(businessId: string, userId: string, isSuperAdmin: boolean) {
    const { governanceService } = await import('../governance/governance.service');
    const guard = await governanceService.guardAction(
      { businessId, userId, isSuperAdmin },
      { actionType: 'AI_RESET_MEMORY', payload: {} }
    );
    if (!guard.proceed) {
      return { approvalRequired: true as const, request: guard.request };
    }
    const result = await prisma.knowledgeDocument.updateMany({
      where: { knowledgeBase: { businessId } },
      data: { embedding: null, status: 'UPLOADED' },
    });
    return { approvalRequired: false as const, affected: result.count };
  }
}

export const aiTrainingService = new AiTrainingService();
