import type { Prisma } from '@prisma/client';
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
import { createNotification } from '../../infrastructure/notifications/notification-helper';
import { logger } from '../../core/logger';

export interface PipelineContext {
  businessId: string;
  jobId: string;
  userId?: string;
  trainerId?: string;
  trainingNotes?: string;
  documentIds?: string[];
}

async function updateJobProgress(
  jobId: string,
  progress: number,
  currentStep: string,
  totalSteps = 6
): Promise<void> {
  await prisma.aiTrainingJob.update({
    where: { id: jobId },
    data: { progress, currentStep, totalSteps },
  });
}

export async function executeTrainingPipeline(ctx: PipelineContext): Promise<string> {
  const { businessId, jobId, userId, trainerId, trainingNotes, documentIds } = ctx;

  await prisma.aiTrainingJob.update({
    where: { id: jobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  await recordAiTrainingAudit(
    { businessId, userId, trainerId },
    'TRAIN_STARTED',
    { entity: 'AiTrainingJob', entityId: jobId }
  );

  try {
    const workspace = await workspaceService.ensureWorkspace(businessId);
    await updateJobProgress(jobId, 5, 'Loading business profile');

    const profile = await businessProfileService.get(businessId);
    await updateJobProgress(jobId, 15, 'Processing documents');

    const bases = await knowledgeService.listBases(businessId);
    const baseId = bases[0]?.id;
    if (!baseId) {
      throw new Error('No knowledge base found for this business');
    }

    let documents = await prisma.knowledgeDocument.findMany({
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
      },
    });

    const toProcess = documents.filter((d) => d.status !== 'INDEXED');
    for (let i = 0; i < toProcess.length; i++) {
      await updateJobProgress(
        jobId,
        15 + Math.round((i / Math.max(toProcess.length, 1)) * 35),
        `Embedding document ${i + 1}/${toProcess.length}`
      );
      await processDocumentById(toProcess[i]!.id, businessId);
    }

    documents = await prisma.knowledgeDocument.findMany({
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
      },
    });

    await updateJobProgress(jobId, 55, 'Building training snapshot');

    const snapshotDocs = documents.map(buildSnapshotDocument);
    const faqCount = documents.filter((d) => d.type === 'FAQ').length;
    const indexedCount = documents.filter((d) => d.status === 'INDEXED').length;
    const embeddingCount = documents.filter((d) => d.embedding).length;
    const totalChunks = snapshotDocs.reduce((sum, d) => sum + d.chunkCount, 0);

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

    await workspaceService.updateWorkspaceMetrics(businessId, {
      sandboxVersionId: version.id,
      lastTrainedAt: new Date(),
      aiReadinessScore: scores.readinessScore,
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
        result: { versionId: version.id, versionNumber, scores } as unknown as Prisma.InputJsonValue,
      },
    });

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
      message: `Version ${versionNumber} is ready for sandbox testing.`,
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

    await recordAiTrainingAudit(
      { businessId, userId, trainerId },
      'TRAIN_FAILED',
      { entity: 'AiTrainingJob', entityId: jobId, newData: { error: message } }
    );

    throw error;
  }
}
