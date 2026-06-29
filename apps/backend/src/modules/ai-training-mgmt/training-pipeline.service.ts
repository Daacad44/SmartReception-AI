import type { AiTrainingJobType, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { businessProfileService } from '../business-profile/business-profile.service';
import { knowledgeService } from '../knowledge/knowledge.service';
import { processDocumentById } from '../../infrastructure/documents/document-processing.service';
import { invalidateKnowledgeCache } from '../../infrastructure/ai/knowledge-search.service';
import { workspaceService } from './workspace.service';
import {
  buildSnapshotDocument,
  calculateQualityScores,
  type TrainingSnapshot,
} from './quality.service';
import { recordAiTrainingAudit } from './audit.service';
import { insightsService } from './insights.service';
import { trainingValidationService } from './training-validation.service';
import { trainingSessionLogService } from './training-session-log.service';
import { trainingEngineService } from './training-engine.service';
import { createNotification } from '../../infrastructure/notifications/notification-helper';
import { logger } from '../../core/logger';

export interface PipelineContext {
  businessId: string;
  jobId: string;
  jobType?: AiTrainingJobType;
  userId?: string;
  trainerId?: string;
  trainingNotes?: string;
  documentIds?: string[];
}

async function updateJobProgress(
  jobId: string,
  progress: number,
  currentStep: string,
  totalSteps = 8
): Promise<void> {
  await prisma.aiTrainingJob.update({
    where: { id: jobId },
    data: { progress, currentStep, totalSteps },
  });
}

async function loadDocuments(
  businessId: string,
  baseId: string,
  documentIds?: string[]
) {
  return prisma.knowledgeDocument.findMany({
    where: {
      knowledgeBaseId: baseId,
      ...(documentIds?.length ? { id: { in: documentIds } } : {}),
    },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      content: true,
      question: true,
      answer: true,
      embedding: true,
      category: true,
      updatedAt: true,
    },
  });
}

export async function executeTrainingPipeline(ctx: PipelineContext): Promise<string | null> {
  const { businessId, jobId, userId, trainerId, trainingNotes } = ctx;
  const job = await prisma.aiTrainingJob.findUnique({ where: { id: jobId } });
  const jobType = ctx.jobType ?? job?.type ?? 'FULL_TRAIN';
  const startedAt = new Date();
  const warnings: string[] = [];
  const errors: string[] = [];
  let embeddingsCreated = 0;
  let embeddingsUpdated = 0;
  let embeddingsDeleted = 0;

  await prisma.aiTrainingJob.update({
    where: { id: jobId },
    data: { status: 'RUNNING', startedAt },
  });

  await recordAiTrainingAudit(
    { businessId, userId, trainerId },
    jobType === 'INCREMENTAL_RETRAIN' ? 'INCREMENTAL_RETRAIN' : 'TRAIN_STARTED',
    { entity: 'AiTrainingJob', entityId: jobId, newData: { jobType } }
  );

  try {
    if (jobType === 'REINDEX') {
      await updateJobProgress(jobId, 20, 'Reindexing knowledge base');
      const result = await trainingEngineService.reindexBusiness(businessId);
      await recordAiTrainingAudit({ businessId, userId, trainerId }, 'REINDEX_STARTED', {
        newData: result,
      });
      embeddingsUpdated = result.processed;
      await finalizeSuccess(jobId, businessId, userId, startedAt, jobType, {
        embeddingsUpdated,
        warnings,
        errors,
        skipVersion: true,
      });
      return null;
    }

    if (jobType === 'EMBED_DOCUMENTS') {
      await updateJobProgress(jobId, 20, 'Rebuilding embeddings');
      const bases = await knowledgeService.listBases(businessId);
      const baseId = bases[0]?.id;
      if (!baseId) throw new Error('No knowledge base found');

      const docs = await prisma.knowledgeDocument.findMany({
        where: { knowledgeBaseId: baseId },
        select: { id: true },
      });

      for (let i = 0; i < docs.length; i++) {
        await updateJobProgress(
          jobId,
          20 + Math.round((i / Math.max(docs.length, 1)) * 60),
          `Embedding document ${i + 1}/${docs.length}`
        );
        await prisma.knowledgeDocument.update({
          where: { id: docs[i]!.id },
          data: { status: 'UPLOADED' },
        });
        await processDocumentById(docs[i]!.id, businessId);
        embeddingsCreated++;
      }

      await recordAiTrainingAudit({ businessId, userId, trainerId }, 'EMBEDDINGS_REBUILT', {
        newData: { count: embeddingsCreated },
      });
      await finalizeSuccess(jobId, businessId, userId, startedAt, jobType, {
        embeddingsCreated,
        warnings,
        errors,
        skipVersion: true,
      });
      return null;
    }

    if (jobType === 'EVALUATE') {
      const workspace = await workspaceService.getWorkspace(businessId);
      const versionId = workspace.sandboxVersionId ?? workspace.productionVersionId;
      if (!versionId) throw new Error('No version available for evaluation');

      await updateJobProgress(jobId, 50, 'Running AI verification');
      const validation = await trainingValidationService.validateTrainingVersion(businessId, versionId);

      await recordAiTrainingAudit(
        { businessId, userId, trainerId, versionId },
        'TRAINING_VALIDATED',
        { newData: validation as unknown as Record<string, unknown> }
      );

      await trainingSessionLogService.finalizeLog(jobId, {
        status: validation.passed ? 'COMPLETED' : 'FAILED',
        validationResult: validation as unknown as Record<string, unknown>,
        qualityScore: validation.qualityScore,
        warnings: validation.warnings,
        errors: validation.errors,
        startedAt,
      });

      await prisma.aiTrainingJob.update({
        where: { id: jobId },
        data: {
          status: validation.passed ? 'COMPLETED' : 'FAILED',
          progress: 100,
          currentStep: validation.passed ? 'Validation passed' : 'Validation failed',
          completedAt: new Date(),
          error: validation.passed ? null : 'AI verification did not pass quality thresholds',
          result: { validation } as unknown as Prisma.InputJsonValue,
        },
      });

      return versionId;
    }

    const workspace = await workspaceService.ensureWorkspace(businessId);
    await updateJobProgress(jobId, 5, 'Loading business profile');

    const profile = await businessProfileService.get(businessId);
    await updateJobProgress(jobId, 15, 'Processing documents');

    const bases = await knowledgeService.listBases(businessId);
    const baseId = bases[0]?.id;
    if (!baseId) throw new Error('No knowledge base found for this business');

    let targetDocumentIds = ctx.documentIds;
    if (
      !targetDocumentIds?.length &&
      (jobType === 'INCREMENTAL_RETRAIN' || jobType === 'PARTIAL_RETRAIN' || jobType === 'RETRAIN')
    ) {
      targetDocumentIds = await trainingEngineService.detectChangedDocuments(businessId);
      if (targetDocumentIds.length) {
        warnings.push(`Incremental retrain: ${targetDocumentIds.length} changed documents detected`);
      } else {
        warnings.push('No changed documents detected — running full knowledge scan');
      }
    }

    let documents = await loadDocuments(businessId, baseId, targetDocumentIds);

    const toProcess =
      jobType === 'FULL_TRAIN' || jobType === 'RETRAIN'
        ? documents.filter((d) => d.status !== 'INDEXED')
        : documents.filter((d) => d.status !== 'INDEXED' || targetDocumentIds?.includes(d.id));

    for (let i = 0; i < toProcess.length; i++) {
      await updateJobProgress(
        jobId,
        15 + Math.round((i / Math.max(toProcess.length, 1)) * 35),
        `Embedding document ${i + 1}/${toProcess.length}`
      );
      await processDocumentById(toProcess[i]!.id, businessId);
      embeddingsCreated++;
    }

    documents = await loadDocuments(businessId, baseId, targetDocumentIds);

    await updateJobProgress(jobId, 55, 'Building training snapshot');

    const snapshotDocs = documents.map(buildSnapshotDocument);
    const faqCount = documents.filter((d) => d.type === 'FAQ').length;
    const indexedCount = documents.filter((d) => d.status === 'INDEXED').length;
    const embeddingCount = documents.filter((d) => d.embedding).length;
    const totalChunks = snapshotDocs.reduce((sum, d) => sum + d.chunkCount, 0);
    const productCount = documents.filter((d) => d.category?.toLowerCase().includes('product')).length;
    const serviceCount = await prisma.service.count({ where: { businessId } });

    const snapshot: TrainingSnapshot = {
      profile,
      documents: snapshotDocs,
      faqCount,
      indexedCount,
      embeddingCount,
      totalChunks,
      capturedAt: new Date().toISOString(),
    };

    await updateJobProgress(jobId, 70, 'Calculating quality scores');
    const scores = calculateQualityScores(snapshot);

    const lastVersion = await prisma.aiTrainingVersion.findFirst({
      where: { businessId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    await updateJobProgress(jobId, 85, 'Creating sandbox version');

    const version = await prisma.aiTrainingVersion.create({
      data: {
        workspaceId: workspace.id,
        businessId,
        versionNumber,
        status: 'SANDBOX',
        trainingNotes,
        trainedByUserId: userId,
        trainedByTrainerId: trainerId,
        knowledgeScore: scores.knowledgeScore,
        confidenceScore: scores.confidenceScore,
        readinessScore: scores.readinessScore,
        hallucinationRisk: scores.hallucinationRisk,
        embeddingVersion: 'gemini-embedding-001',
        snapshotData: snapshot as object,
        documentCount: documents.length,
        chunkCount: totalChunks,
      },
    });

    await updateJobProgress(jobId, 92, 'Running post-training AI verification');
    const validation = await trainingValidationService.validateTrainingVersion(businessId, version.id);

    if (!validation.passed) {
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
      await prisma.aiTrainingVersion.update({
        where: { id: version.id },
        data: { status: 'DRAFT' },
      });

      await trainingSessionLogService.finalizeLog(jobId, {
        status: 'FAILED',
        knowledgeCount: documents.length,
        documentsCount: documents.length,
        faqCount,
        productCount,
        serviceCount,
        embeddingsCreated,
        embeddingsUpdated,
        embeddingsDeleted,
        tokensUsed: totalChunks * 400,
        estimatedCost: trainingEngineService.estimateTrainingCost(documents.length, totalChunks),
        warnings,
        errors,
        validationResult: validation as unknown as Record<string, unknown>,
        qualityScore: validation.qualityScore,
        startedAt,
        metadata: { versionId: version.id, versionNumber },
      });

      await prisma.aiTrainingJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          progress: 100,
          currentStep: 'Validation failed',
          completedAt: new Date(),
          versionId: version.id,
          error: 'Post-training AI verification failed',
          result: { versionId: version.id, validation } as unknown as Prisma.InputJsonValue,
        },
      });

      await recordAiTrainingAudit(
        { businessId, versionId: version.id, userId, trainerId },
        'TRAIN_FAILED',
        { entity: 'AiTrainingJob', entityId: jobId, newData: { validation } }
      );

      throw new Error('Training validation failed — version not marked successful');
    }

    const isRetrain = ['RETRAIN', 'INCREMENTAL_RETRAIN', 'PARTIAL_RETRAIN'].includes(jobType);

    await workspaceService.updateWorkspaceMetrics(businessId, {
      sandboxVersionId: version.id,
      lastTrainedAt: new Date(),
      ...(isRetrain ? { lastRetrainedAt: new Date() } : {}),
      aiReadinessScore: validation.qualityScore || scores.readinessScore,
      knowledgeScore: scores.knowledgeScore,
      confidenceScore: scores.confidenceScore,
      embeddingCount,
      documentCount: documents.length,
    });

    invalidateKnowledgeCache(businessId);
    await insightsService.generateInsights(businessId, snapshot, scores);

    await prisma.aiTrainingJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        currentStep: 'Completed',
        completedAt: new Date(),
        versionId: version.id,
        result: { versionId: version.id, versionNumber, scores, validation } as unknown as Prisma.InputJsonValue,
      },
    });

    await trainingSessionLogService.finalizeLog(jobId, {
      status: 'COMPLETED',
      knowledgeCount: documents.length,
      documentsCount: documents.length,
      faqCount,
      productCount,
      serviceCount,
      embeddingsCreated,
      embeddingsUpdated,
      embeddingsDeleted,
      tokensUsed: totalChunks * 400,
      estimatedCost: trainingEngineService.estimateTrainingCost(documents.length, totalChunks),
      warnings,
      errors,
      validationResult: validation as unknown as Record<string, unknown>,
      qualityScore: validation.qualityScore,
      startedAt,
      metadata: { versionId: version.id, versionNumber },
    });

    await recordAiTrainingAudit(
      { businessId, versionId: version.id, userId, trainerId },
      'TRAINING_VALIDATED',
      { newData: validation as unknown as Record<string, unknown> }
    );

    await recordAiTrainingAudit(
      { businessId, versionId: version.id, userId, trainerId },
      'TRAIN_COMPLETED',
      { entity: 'AiTrainingVersion', entityId: version.id, newData: { versionNumber, scores } }
    );

    await recordAiTrainingAudit(
      { businessId, versionId: version.id, userId, trainerId },
      'VERSION_CREATED',
      { entity: 'AiTrainingVersion', entityId: version.id }
    );

    await createNotification({
      businessId,
      userId: userId ?? undefined,
      type: 'AI_TRAINING_COMPLETE',
      title: 'AI training completed',
      message: `Version ${versionNumber} passed validation and is ready for sandbox testing.`,
      data: { versionId: version.id, versionNumber },
    });

    return version.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Training failed';
    logger.error('Training pipeline failed', { jobId, businessId, error: message });

    await prisma.aiTrainingJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        error: message,
        completedAt: new Date(),
      },
    });

    await trainingSessionLogService.finalizeLog(jobId, {
      status: 'FAILED',
      errors: [message],
      startedAt,
    });

    await recordAiTrainingAudit(
      { businessId, userId, trainerId },
      'TRAIN_FAILED',
      { entity: 'AiTrainingJob', entityId: jobId, newData: { error: message } }
    );

    throw error;
  }
}

async function finalizeSuccess(
  jobId: string,
  businessId: string,
  userId: string | undefined,
  startedAt: Date,
  jobType: AiTrainingJobType,
  data: {
    embeddingsCreated?: number;
    embeddingsUpdated?: number;
    embeddingsDeleted?: number;
    warnings: string[];
    errors: string[];
    skipVersion?: boolean;
  }
) {
  await prisma.aiTrainingJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      progress: 100,
      currentStep: 'Completed',
      completedAt: new Date(),
    },
  });

  await trainingSessionLogService.finalizeLog(jobId, {
    status: 'COMPLETED',
    embeddingsCreated: data.embeddingsCreated,
    embeddingsUpdated: data.embeddingsUpdated,
    embeddingsDeleted: data.embeddingsDeleted,
    warnings: data.warnings,
    errors: data.errors,
    startedAt,
    metadata: { skipVersion: data.skipVersion, jobType },
  });

  await recordAiTrainingAudit(
    { businessId, userId },
    'TRAIN_COMPLETED',
    { entity: 'AiTrainingJob', entityId: jobId }
  );
}
