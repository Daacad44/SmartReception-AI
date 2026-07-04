import { prisma } from '../../infrastructure/database/prisma';
import { knowledgeService } from '../knowledge/knowledge.service';
import { workspaceService } from './workspace.service';
import { trainingEngineService } from './training-engine.service';
import { trainingSessionLogService } from './training-session-log.service';
import { versionService } from './version.service';

export class TrainingCenterService {
  async listBusinessCards(page = 1, limit = 50, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          industry: true,
          isActive: true,
          createdAt: true,
          aiTrainingWorkspace: {
            include: {
              productionVersion: {
                select: {
                  id: true,
                  versionNumber: true,
                  status: true,
                  embeddingVersion: true,
                  readinessScore: true,
                  createdAt: true,
                },
              },
              sandboxVersion: {
                select: { id: true, versionNumber: true, status: true, createdAt: true },
              },
            },
          },
        },
      }),
      prisma.business.count({ where }),
    ]);

    const cards = await Promise.all(
      businesses.map(async (b) => {
        const workspace = b.aiTrainingWorkspace ?? (await workspaceService.ensureWorkspace(b.id));
        const bases = await knowledgeService.listBases(b.id);
        const baseId = bases[0]?.id;

        const [documents, chunks, services, faqs, lastJob, lastRetrainJob] = await Promise.all([
          baseId
            ? prisma.knowledgeDocument.findMany({
                where: { knowledgeBaseId: baseId },
                select: { id: true, type: true, status: true, category: true },
              })
            : [],
          prisma.knowledgeChunk.count({ where: { businessId: b.id, isActive: true } }),
          prisma.service.count({ where: { businessId: b.id } }),
          baseId ? knowledgeService.listFaqs(b.id, baseId) : [],
          prisma.aiTrainingJob.findFirst({
            where: { businessId: b.id },
            orderBy: { createdAt: 'desc' },
            select: { id: true, type: true, status: true, completedAt: true, createdAt: true },
          }),
          prisma.aiTrainingJob.findFirst({
            where: {
              businessId: b.id,
              type: { in: ['RETRAIN', 'INCREMENTAL_RETRAIN', 'PARTIAL_RETRAIN'] },
              status: 'COMPLETED',
            },
            orderBy: { completedAt: 'desc' },
            select: { completedAt: true },
          }),
        ]);

        const docCount = documents.length;
        const faqCount = documents.filter((d) => d.type === 'FAQ').length;
        const productCount = documents.filter(
          (d) => d.category?.toLowerCase().includes('product') || d.type === 'PDF'
        ).length;
        const indexed = documents.filter((d) => d.status === 'INDEXED').length;
        const embeddingStatus =
          indexed === docCount && docCount > 0
            ? 'COMPLETE'
            : indexed > 0
              ? 'PARTIAL'
              : docCount > 0
                ? 'PENDING'
                : 'EMPTY';

        const production = workspace.productionVersion ?? b.aiTrainingWorkspace?.productionVersion;
        const trainingStatus =
          lastJob?.status === 'RUNNING' || lastJob?.status === 'QUEUED'
            ? 'IN_PROGRESS'
            : production?.status ?? 'NOT_STARTED';

        const knowledgeHealth = workspace.aiReadinessScore ?? production?.readinessScore ?? 0;
        const estimatedTrainingCost = trainingEngineService.estimateTrainingCost(docCount, chunks);

        return {
          businessId: b.id,
          name: b.name,
          logoUrl: b.logoUrl,
          industry: b.industry,
          status: b.isActive ? 'ACTIVE' : 'INACTIVE',
          knowledgeBaseSize: docCount + faqs.length,
          documents: docCount,
          faqs: faqCount,
          products: productCount,
          services,
          embeddingsCount: chunks,
          knowledgeHealth,
          trainingStatus,
          lastTraining: workspace.lastTrainedAt ?? production?.createdAt ?? null,
          lastRetraining: workspace.lastRetrainedAt ?? lastRetrainJob?.completedAt ?? null,
          currentAiProvider: trainingEngineService.getCurrentAiProvider(),
          embeddingStatus,
          knowledgeVersion: production?.versionNumber ?? null,
          aiVersion: production?.embeddingVersion ?? 'gemini-embedding-001',
          estimatedTrainingCost,
          trainingHealthScore: workspace.aiReadinessScore ?? production?.readinessScore ?? null,
          productionVersionId: production?.id ?? null,
          sandboxVersionId: workspace.sandboxVersionId ?? b.aiTrainingWorkspace?.sandboxVersion?.id ?? null,
          lastJob,
        };
      })
    );

    return { data: cards, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getBusinessDetail(businessId: string) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!business) return null;

    const { data: cards } = await this.listBusinessCards(1, 1000);
    const card = cards.find((c) => c.businessId === businessId);
    if (!card) return null;

    const [versions, sessions, jobs, insights] = await Promise.all([
      versionService.listVersions(businessId),
      trainingSessionLogService.listSessions({ businessId, limit: 30 }),
      prisma.aiTrainingJob.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: {
          version: { select: { versionNumber: true, status: true } },
          createdByUser: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.aiTrainingInsight.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      ...(card ?? { businessId }),
      versions,
      sessions: sessions.data,
      jobs,
      insights,
    };
  }

  async getPlatformOverview() {
    const [businessCount, activeJobs, recentSessions, avgScore] = await Promise.all([
      prisma.business.count({ where: { isActive: true } }),
      prisma.aiTrainingJob.count({ where: { status: { in: ['QUEUED', 'RUNNING'] } } }),
      trainingSessionLogService.listSessions({ limit: 10 }),
      prisma.aiTrainingWorkspace.aggregate({ _avg: { aiReadinessScore: true } }),
    ]);

    return {
      totalBusinesses: businessCount,
      activeTrainingJobs: activeJobs,
      averageHealthScore: avgScore._avg.aiReadinessScore ?? 0,
      recentSessions: recentSessions.data,
    };
  }
}

export const trainingCenterService = new TrainingCenterService();
