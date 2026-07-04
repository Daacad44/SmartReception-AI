import type { AiTrainingJobStatus, AiTrainingJobType, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';

export class TrainingSessionLogService {
  async createPendingLog(params: {
    jobId: string;
    businessId: string;
    operatorUserId?: string;
    trainingType: AiTrainingJobType;
  }) {
    return prisma.aiTrainingSessionLog.create({
      data: {
        jobId: params.jobId,
        businessId: params.businessId,
        operatorUserId: params.operatorUserId,
        startedAt: new Date(),
        trainingType: params.trainingType,
        status: 'QUEUED',
      },
    });
  }

  async finalizeLog(
    jobId: string,
    data: {
      status: AiTrainingJobStatus;
      knowledgeCount?: number;
      documentsCount?: number;
      faqCount?: number;
      productCount?: number;
      serviceCount?: number;
      embeddingsCreated?: number;
      embeddingsUpdated?: number;
      embeddingsDeleted?: number;
      tokensUsed?: number;
      estimatedCost?: number;
      warnings?: string[];
      errors?: string[];
      validationResult?: Record<string, unknown>;
      qualityScore?: number;
      metadata?: Record<string, unknown>;
      startedAt?: Date;
    }
  ) {
    const finishedAt = new Date();
    const existing = await prisma.aiTrainingSessionLog.findUnique({ where: { jobId } });
    const startedAt = data.startedAt ?? existing?.startedAt ?? finishedAt;
    const durationMs = finishedAt.getTime() - startedAt.getTime();

    const payload: Prisma.AiTrainingSessionLogUpdateInput = {
      finishedAt,
      durationMs,
      status: data.status,
      knowledgeCount: data.knowledgeCount,
      documentsCount: data.documentsCount,
      faqCount: data.faqCount,
      productCount: data.productCount,
      serviceCount: data.serviceCount,
      embeddingsCreated: data.embeddingsCreated,
      embeddingsUpdated: data.embeddingsUpdated,
      embeddingsDeleted: data.embeddingsDeleted,
      tokensUsed: data.tokensUsed,
      estimatedCost: data.estimatedCost,
      warnings: data.warnings as Prisma.InputJsonValue,
      errors: data.errors as Prisma.InputJsonValue,
      validationResult: data.validationResult as Prisma.InputJsonValue,
      qualityScore: data.qualityScore,
      metadata: data.metadata as Prisma.InputJsonValue,
    };

    if (existing) {
      return prisma.aiTrainingSessionLog.update({ where: { jobId }, data: payload });
    }

    const job = await prisma.aiTrainingJob.findUnique({ where: { id: jobId } });
    if (!job) return null;

    return prisma.aiTrainingSessionLog.create({
      data: {
        jobId,
        businessId: job.businessId,
        operatorUserId: job.createdByUserId ?? undefined,
        startedAt,
        trainingType: job.type,
        ...payload,
        finishedAt,
        durationMs,
        status: data.status,
      } as Prisma.AiTrainingSessionLogCreateInput,
    });
  }

  async listSessions(filters: {
    businessId?: string;
    limit?: number;
    offset?: number;
  }) {
    const { businessId, limit = 50, offset = 0 } = filters;
    const [data, total] = await Promise.all([
      prisma.aiTrainingSessionLog.findMany({
        where: businessId ? { businessId } : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          business: { select: { id: true, name: true } },
          operator: { select: { id: true, firstName: true, lastName: true, email: true } },
          job: { select: { id: true, type: true, versionId: true } },
        },
      }),
      prisma.aiTrainingSessionLog.count({
        where: businessId ? { businessId } : undefined,
      }),
    ]);

    return { data, meta: { total, limit, offset } };
  }

  async getSession(sessionId: string) {
    return prisma.aiTrainingSessionLog.findUnique({
      where: { id: sessionId },
      include: {
        business: { select: { id: true, name: true, industry: true } },
        operator: { select: { id: true, firstName: true, lastName: true, email: true } },
        job: {
          include: {
            version: { select: { id: true, versionNumber: true, status: true, readinessScore: true } },
          },
        },
      },
    });
  }
}

export const trainingSessionLogService = new TrainingSessionLogService();
