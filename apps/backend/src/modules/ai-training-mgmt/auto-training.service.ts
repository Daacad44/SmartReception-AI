import { prisma } from '../../infrastructure/database/prisma';
import { trainingJobService } from './training-job.service';
import { logger } from '../../core/logger';

let trainingJobServiceInstance: typeof trainingJobService | null = null;

async function getTrainingJobService() {
  if (!trainingJobServiceInstance) {
    trainingJobServiceInstance = trainingJobService;
  }
  return trainingJobServiceInstance;
}

export async function scheduleAutoTrainingAfterProcessing(businessId: string): Promise<void> {
  try {
    const runningJob = await prisma.aiTrainingJob.findFirst({
      where: {
        businessId,
        status: { in: ['QUEUED', 'RUNNING'] },
      },
    });
    if (runningJob) return;

    const indexedCount = await prisma.knowledgeDocument.count({
      where: {
        knowledgeBase: { businessId },
        status: 'INDEXED',
      },
    });
    if (indexedCount === 0) return;

    const service = await getTrainingJobService();
    const jobType = indexedCount <= 3 ? 'FULL_TRAIN' : 'INCREMENTAL_RETRAIN';
    await service.createJob({
      businessId,
      type: jobType,
      trainingNotes: 'Auto-triggered after knowledge processing',
    });
    logger.info('Auto-training scheduled after document processing', { businessId, jobType });
  } catch (error) {
    logger.warn('Failed to schedule auto-training after processing', {
      businessId,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}
