import { Prisma, type AiTrainingJobType } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { getAiTrainingQueue } from '../../infrastructure/queue/queues';
import { workspaceService } from './workspace.service';
import { executeTrainingPipeline } from './training-pipeline.service';
import { logger } from '../../core/logger';

const ACTIVE_JOB_STATUSES = ['QUEUED', 'RUNNING'] as const;
export const DEFAULT_STALE_TRAINING_JOB_MS = 30 * 60 * 1000;

export function staleTrainingJobCutoff(
  now = new Date(),
  staleAfterMs = DEFAULT_STALE_TRAINING_JOB_MS
): Date {
  return new Date(now.getTime() - staleAfterMs);
}

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

    let result: { existing: boolean; job: Awaited<ReturnType<typeof prisma.aiTrainingJob.create>> };
    try {
      result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-training-job:${input.businessId}`}))`;

        const running = await tx.aiTrainingJob.findFirst({
          where: {
            businessId: input.businessId,
            status: { in: [...ACTIVE_JOB_STATUSES] },
          },
        });
        if (running) return { existing: true, job: running };

        const job = await tx.aiTrainingJob.create({
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
        return { existing: false, job };
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      const active = await prisma.aiTrainingJob.findFirst({
        where: { businessId: input.businessId, status: { in: [...ACTIVE_JOB_STATUSES] } },
      });
      if (!active) throw error;
      result = { existing: true, job: active };
    }

    if (result.existing) return result;
    const job = result.job;

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

  async recoverStaleJobs(staleAfterMs = DEFAULT_STALE_TRAINING_JOB_MS) {
    const cutoff = staleTrainingJobCutoff(new Date(), staleAfterMs);
    const queue = getAiTrainingQueue();
    const staleRunning = await prisma.aiTrainingJob.findMany({
      where: { status: 'RUNNING', updatedAt: { lt: cutoff } },
      take: 100,
    });
    let failedRunning = 0;
    if (queue) {
      for (const job of staleRunning) {
        const bullJob = await queue.getJob(job.bullJobId ?? job.id);
        if (bullJob && (await bullJob.isActive())) continue;
        const failed = await prisma.aiTrainingJob.updateMany({
          where: { id: job.id, status: 'RUNNING', updatedAt: { lt: cutoff } },
          data: {
            status: 'FAILED',
            error: 'Training worker heartbeat expired; start a new training run',
            completedAt: new Date(),
          },
        });
        failedRunning += failed.count;
      }
    }

    const queued = await prisma.aiTrainingJob.findMany({
      where: { status: 'QUEUED', updatedAt: { lt: cutoff } },
      take: 100,
    });
    let requeued = 0;
    if (queue) {
      for (const job of queued) {
        const payload = (job.payload as { trainingNotes?: string; documentIds?: string[] } | null) ?? {};
        const bullJob = await queue.getJob(job.id);
        const state = bullJob ? await bullJob.getState() : 'missing';
        if (!bullJob || state === 'completed' || state === 'failed') {
          if (bullJob) await bullJob.remove();
          await queue.add(
            'train',
            {
              jobId: job.id,
              businessId: job.businessId,
              jobType: job.type,
              userId: job.createdByUserId ?? undefined,
              trainerId: job.createdByTrainerId ?? undefined,
              ...payload,
            },
            { jobId: job.id, removeOnComplete: 100, removeOnFail: 50 }
          );
          await prisma.aiTrainingJob.update({
            where: { id: job.id },
            data: { bullJobId: job.id },
          });
          requeued++;
        }
      }
    }

    return {
      failedRunning,
      requeued,
      pendingWithoutQueue: queue ? 0 : queued.length + staleRunning.length,
    };
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
    const cancelled = await prisma.aiTrainingJob.updateMany({
      where: { id: jobId, businessId, status: { in: [...ACTIVE_JOB_STATUSES] } },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
    if (cancelled.count !== 1) return null;

    const job = await prisma.aiTrainingJob.findUniqueOrThrow({ where: { id: jobId } });

    const queue = getAiTrainingQueue();
    if (queue && job.bullJobId) {
      const bullJob = await queue.getJob(job.bullJobId);
      // BullMQ cannot remove an actively locked job. The persisted CANCELLED
      // state below is therefore also checked cooperatively by the pipeline.
      if (bullJob && !(await bullJob.isActive())) await bullJob.remove();
    }

    return job;
  }
}

export const trainingJobService = new TrainingJobService();
