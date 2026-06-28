import { prisma } from '../../infrastructure/database/prisma';

export class WorkspaceService {
  async ensureWorkspace(businessId: string) {
    const existing = await prisma.aiTrainingWorkspace.findUnique({
      where: { businessId },
      include: {
        productionVersion: true,
        sandboxVersion: true,
      },
    });
    if (existing) return existing;

    return prisma.aiTrainingWorkspace.create({
      data: { businessId },
      include: {
        productionVersion: true,
        sandboxVersion: true,
      },
    });
  }

  async getWorkspace(businessId: string) {
    return this.ensureWorkspace(businessId);
  }

  async updateWorkspaceMetrics(
    businessId: string,
    metrics: {
      aiReadinessScore?: number;
      knowledgeScore?: number;
      confidenceScore?: number;
      embeddingCount?: number;
      documentCount?: number;
      lastTrainedAt?: Date;
      sandboxVersionId?: string;
      productionVersionId?: string;
    }
  ) {
    await this.ensureWorkspace(businessId);
    return prisma.aiTrainingWorkspace.update({
      where: { businessId },
      data: metrics,
      include: {
        productionVersion: true,
        sandboxVersion: true,
      },
    });
  }
}

export const workspaceService = new WorkspaceService();
