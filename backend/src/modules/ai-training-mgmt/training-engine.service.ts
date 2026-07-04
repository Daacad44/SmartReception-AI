import type { AiTrainingJobType, AiTrainingOperation } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { config } from '../../config';
import { trainingJobService } from './training-job.service';
import { versionService } from './version.service';
import { trainingSessionLogService } from './training-session-log.service';
import { processDocumentById } from '../../infrastructure/documents/document-processing.service';
import { knowledgeService } from '../knowledge/knowledge.service';
import { invalidateKnowledgeCache } from '../../infrastructure/ai/knowledge-search.service';
import { recordAiTrainingAudit } from './audit.service';
import { workspaceService } from './workspace.service';
import { ValidationError } from '../../core/errors';

export interface ExecuteOperationInput {
  operation: AiTrainingOperation;
  businessIds: string[];
  jobType?: AiTrainingJobType;
  payload: Record<string, unknown>;
  userId: string;
}

function resolveJobType(operation: AiTrainingOperation, jobType?: AiTrainingJobType): AiTrainingJobType {
  if (jobType) return jobType;
  switch (operation) {
    case 'RETRAIN_ONE':
      return 'INCREMENTAL_RETRAIN';
    case 'REBUILD_EMBEDDINGS':
    case 'GENERATE_EMBEDDINGS':
      return 'EMBED_DOCUMENTS';
    case 'REINDEX':
      return 'REINDEX';
    case 'VALIDATE':
      return 'EVALUATE';
    case 'OPTIMIZE':
      return 'PARTIAL_RETRAIN';
    default:
      return 'FULL_TRAIN';
  }
}

export class TrainingEngineService {
  async executeVerifiedOperation(input: ExecuteOperationInput) {
    const { operation, payload, userId } = input;
    let businessIds = input.businessIds;

    if (operation === 'TRAIN_ALL') {
      const all = await prisma.business.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      businessIds = all.map((b) => b.id);
    }

    if (!businessIds.length) {
      throw new ValidationError('No businesses selected for training');
    }

    switch (operation) {
      case 'PREVIEW':
        return this.previewTraining(businessIds[0]!);
      case 'COMPARE_VERSIONS':
        return this.compareVersions(
          businessIds[0]!,
          String(payload.versionAId ?? ''),
          String(payload.versionBId ?? '')
        );
      case 'ROLLBACK':
        return this.rollbackVersion(businessIds[0]!, String(payload.versionId ?? ''), userId);
      case 'DELETE_OLD_EMBEDDINGS':
        return this.deleteOldEmbeddings(businessIds[0]!, userId);
      case 'VALIDATE':
        return this.validateBusiness(businessIds[0]!, userId);
      case 'OPTIMIZE':
        return this.optimizeKnowledge(businessIds[0]!, userId);
      case 'REINDEX':
      case 'REBUILD_EMBEDDINGS':
      case 'GENERATE_EMBEDDINGS':
        return this.enqueueForBusinesses(businessIds, resolveJobType(operation), userId, payload);
      default:
        return this.enqueueForBusinesses(businessIds, resolveJobType(operation, input.jobType), userId, payload);
    }
  }

  private async enqueueForBusinesses(
    businessIds: string[],
    type: AiTrainingJobType,
    userId: string,
    payload: Record<string, unknown>
  ) {
    const jobs = [];
    for (const businessId of businessIds) {
      const result = await trainingJobService.createJob({
        businessId,
        type,
        userId,
        trainingNotes: payload.trainingNotes as string | undefined,
        documentIds: payload.documentIds as string[] | undefined,
      });

      if (!result.existing) {
        await trainingSessionLogService.createPendingLog({
          jobId: result.job.id,
          businessId,
          operatorUserId: userId,
          trainingType: type,
        });
      }

      jobs.push({
        businessId,
        jobId: result.job.id,
        status: result.job.status,
        existing: result.existing,
      });
    }

    return { operation: type, businesses: businessIds.length, jobs };
  }

  private async previewTraining(businessId: string) {
    const workspace = await workspaceService.ensureWorkspace(businessId);
    const bases = await knowledgeService.listBases(businessId);
    const baseId = bases[0]?.id;
    const [documents, chunks, services, versions] = await Promise.all([
      baseId
        ? prisma.knowledgeDocument.findMany({
            where: { knowledgeBaseId: baseId },
            select: { id: true, title: true, type: true, status: true, updatedAt: true },
          })
        : [],
      prisma.knowledgeChunk.count({ where: { businessId, isActive: true } }),
      prisma.service.count({ where: { businessId } }),
      prisma.aiTrainingVersion.findMany({
        where: { businessId },
        orderBy: { versionNumber: 'desc' },
        take: 3,
        select: { id: true, versionNumber: true, status: true, readinessScore: true },
      }),
    ]);

    const faqs = documents.filter((d) => d.type === 'FAQ').length;
    const unindexed = documents.filter((d) => d.status !== 'INDEXED').length;

    return {
      businessId,
      preview: true,
      documents: documents.length,
      faqs,
      services,
      chunks,
      unindexed,
      workspace: {
        lastTrainedAt: workspace.lastTrainedAt,
        lastRetrainedAt: workspace.lastRetrainedAt,
        readinessScore: workspace.aiReadinessScore,
      },
      recentVersions: versions,
      estimatedCost: this.estimateTrainingCost(documents.length, chunks),
    };
  }

  private async compareVersions(businessId: string, versionAId: string, versionBId: string) {
    if (!versionAId || !versionBId) {
      throw new ValidationError('versionAId and versionBId are required');
    }
    return versionService.compareVersions(businessId, versionAId, versionBId);
  }

  private async rollbackVersion(businessId: string, versionId: string, userId: string) {
    if (!versionId) throw new ValidationError('versionId is required');
    const version = await versionService.rollback(businessId, versionId, { businessId, userId });
    return { rolledBack: true, version };
  }

  private async deleteOldEmbeddings(businessId: string, userId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deleted = await prisma.knowledgeChunk.updateMany({
      where: {
        businessId,
        isActive: false,
        updatedAt: { lt: thirtyDaysAgo },
      },
      data: { isActive: false },
    });

    const removed = await prisma.knowledgeChunk.deleteMany({
      where: { businessId, isActive: false, updatedAt: { lt: thirtyDaysAgo } },
    });

    await recordAiTrainingAudit(
      { businessId, userId },
      'EMBEDDINGS_REBUILT',
      { newData: { deletedInactive: deleted.count, removed: removed.count } }
    );

    return { deleted: removed.count };
  }

  private async validateBusiness(businessId: string, userId: string) {
    const workspace = await workspaceService.getWorkspace(businessId);
    const versionId = workspace.sandboxVersionId ?? workspace.productionVersionId;
    if (!versionId) throw new ValidationError('No trained version available to validate');

    const job = await trainingJobService.createJob({
      businessId,
      type: 'EVALUATE',
      userId,
    });

    return { jobId: job.job.id, versionId };
  }

  private async optimizeKnowledge(businessId: string, userId: string) {
    const bases = await knowledgeService.listBases(businessId);
    const baseId = bases[0]?.id;
    if (!baseId) throw new ValidationError('No knowledge base found');

    const duplicates = await prisma.$queryRaw<Array<{ content: string; count: bigint }>>`
      SELECT LEFT("content", 200) AS content, COUNT(*)::bigint AS count
      FROM "knowledge_chunks"
      WHERE "businessId" = ${businessId} AND "isActive" = true
      GROUP BY 1
      HAVING COUNT(*) > 1
      LIMIT 50
    `;

    let removed = 0;
    for (const dup of duplicates) {
      const chunks = await prisma.knowledgeChunk.findMany({
        where: { businessId, isActive: true, content: { startsWith: dup.content.slice(0, 200) } },
        orderBy: { createdAt: 'asc' },
      });
      const toDeactivate = chunks.slice(1);
      if (toDeactivate.length) {
        await prisma.knowledgeChunk.updateMany({
          where: { id: { in: toDeactivate.map((c) => c.id) } },
          data: { isActive: false },
        });
        removed += toDeactivate.length;
      }
    }

    invalidateKnowledgeCache(businessId);

    await recordAiTrainingAudit(
      { businessId, userId },
      'KNOWLEDGE_OPTIMIZED',
      { newData: { duplicatesRemoved: removed } }
    );

    return { optimized: true, duplicatesRemoved: removed };
  }

  async reindexBusiness(businessId: string) {
    const bases = await knowledgeService.listBases(businessId);
    const baseId = bases[0]?.id;
    if (!baseId) return { processed: 0 };

    const documents = await prisma.knowledgeDocument.findMany({
      where: { knowledgeBaseId: baseId },
      select: { id: true },
    });

    for (const doc of documents) {
      await prisma.knowledgeDocument.update({
        where: { id: doc.id },
        data: { status: 'UPLOADED' },
      });
      await processDocumentById(doc.id, businessId);
    }

    return { processed: documents.length };
  }

  async detectChangedDocuments(businessId: string): Promise<string[]> {
    const workspace = await workspaceService.getWorkspace(businessId);
    const productionId = workspace.productionVersionId;
    if (!productionId) return [];

    const production = await prisma.aiTrainingVersion.findUnique({
      where: { id: productionId },
      select: { snapshotData: true },
    });

    const snap = production?.snapshotData as {
      documents?: Array<{ id: string; updatedAt?: string }>;
    } | null;
    const snapMap = new Map((snap?.documents ?? []).map((d) => [d.id, d.updatedAt]));

    const bases = await knowledgeService.listBases(businessId);
    const baseId = bases[0]?.id;
    if (!baseId) return [];

    const current = await prisma.knowledgeDocument.findMany({
      where: { knowledgeBaseId: baseId },
      select: { id: true, updatedAt: true, status: true },
    });

    const changed: string[] = [];
    for (const doc of current) {
      const prev = snapMap.get(doc.id);
      if (!prev || doc.status !== 'INDEXED') {
        changed.push(doc.id);
      } else if (new Date(prev).getTime() < doc.updatedAt.getTime()) {
        changed.push(doc.id);
      }
    }

    const currentIds = new Set(current.map((d) => d.id));
    for (const [id] of snapMap) {
      if (!currentIds.has(id)) {
        // deleted knowledge — full retrain marker
        return current.map((d) => d.id);
      }
    }

    return changed;
  }

  estimateTrainingCost(documentCount: number, chunkCount: number): number {
    const tokensPerChunk = 400;
    const totalTokens = (documentCount + chunkCount) * tokensPerChunk;
    const inputCost = (totalTokens * 0.6 * 0.15) / 1_000_000;
    const outputCost = (totalTokens * 0.4 * 0.6) / 1_000_000;
    return Number((inputCost + outputCost).toFixed(4));
  }

  getCurrentAiProvider(): string {
    return config.ai.provider || 'gemini';
  }
}

export const trainingEngineService = new TrainingEngineService();
