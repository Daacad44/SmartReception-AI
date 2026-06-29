import type { AiTrainingJobType } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { getAiTrainingQueue } from '../../infrastructure/queue/queues';
import { workspaceService } from './workspace.service';
import { executeTrainingPipeline } from './training-pipeline.service';
import { recordAiTrainingAudit } from './audit.service';
import { logger } from '../../core/logger';

export interface CreateJobInput {
  businessId: string;
  type: AiTrainingJobType;
  userId?: string;
  trainerId?: string;
  trainingNotes?: string;
  documentIds?: string[];
}

export class TrainingJobService {
  async createJob(input: CreateJobInput) {
    const workspace = await workspaceService.ensureWorkspace(input.businessId);

    const running = await prisma.aiTrainingJob.findFirst({
      where: {
        businessId: input.businessId,
        status: { in: ['QUEUED', 'RUNNING'] },
      },
    });
    if (running) {
      return { existing: true, job: running };
    }

    const job = await prisma.aiTrainingJob.create({
      data: {
        businessId: input.businessId,
        workspaceId: workspace.id,
        type: input.type,
        status: 'QUEUED',
        payload: {
          trainingNotes: input.trainingNotes,
          documentIds: input.documentIds,
        },
        createdByUserId: input.userId,
        createdByTrainerId: input.trainerId,
      },
    });

    const queue = getAiTrainingQueue();
    if (queue) {
      const bullJob = await queue.add(
        'train',
        {
          jobId: job.id,
          businessId: input.businessId,
          jobType: input.type,
          userId: input.userId,
          trainerId: input.trainerId,
          trainingNotes: input.trainingNotes,
          documentIds: input.documentIds,
        },
        { jobId: job.id, removeOnComplete: 100, removeOnFail: 50 }
      );
      await prisma.aiTrainingJob.update({
        where: { id: job.id },
        data: { bullJobId: bullJob.id },
      });
    } else {
      logger.warn('Redis unavailable — running training pipeline inline');
      void executeTrainingPipeline({
        businessId: input.businessId,
        jobId: job.id,
        jobType: input.type,
        userId: input.userId,
        trainerId: input.trainerId,
        trainingNotes: input.trainingNotes,
        documentIds: input.documentIds,
      }).catch((err) => logger.error('Inline training failed', err));
    }

    return { existing: false, job };
  }

  async listJobs(businessId: string, limit = 20) {
    return prisma.aiTrainingJob.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        version: { select: { id: true, versionNumber: true, status: true } },
        createdByUser: { select: { id: true, firstName: true, lastName: true } },
        createdByTrainer: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getJob(businessId: string, jobId: string) {
    return prisma.aiTrainingJob.findFirst({
      where: { id: jobId, businessId },
      include: {
        version: true,
        createdByUser: { select: { id: true, firstName: true, lastName: true } },
        createdByTrainer: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async cancelJob(businessId: string, jobId: string) {
    const job = await prisma.aiTrainingJob.findFirst({
      where: { id: jobId, businessId, status: { in: ['QUEUED', 'RUNNING'] } },
    });
    if (!job) return null;

    const queue = getAiTrainingQueue();
    if (queue && job.bullJobId) {
      const bullJob = await queue.getJob(job.bullJobId);
      if (bullJob) await bullJob.remove();
    }

    return prisma.aiTrainingJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
  }
}

export const trainingJobService = new TrainingJobService();
