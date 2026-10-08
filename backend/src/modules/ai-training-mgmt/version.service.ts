import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError } from '../../core/errors';
import { recordAiTrainingAudit, type AuditContext } from './audit.service';
import { invalidateKnowledgeCache } from '../../infrastructure/ai/knowledge-search.service';

export class VersionService {
  async listVersions(businessId: string) {
    return prisma.aiTrainingVersion.findMany({
      where: { businessId },
      orderBy: { versionNumber: 'desc' },
      include: {
        trainedByUser: { select: { id: true, firstName: true, lastName: true } },
        trainedByTrainer: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getVersion(businessId: string, versionId: string) {
    const version = await prisma.aiTrainingVersion.findFirst({
      where: { id: versionId, businessId },
      include: {
        trainedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        trainedByTrainer: { select: { id: true, firstName: true, lastName: true, username: true } },
      },
    });
    if (!version) throw new NotFoundError('Version not found');
    return version;
  }

  async compareVersions(businessId: string, versionAId: string, versionBId: string) {
    const [a, b] = await Promise.all([
      this.getVersion(businessId, versionAId),
      this.getVersion(businessId, versionBId),
    ]);

    const snapA = a.snapshotData as { documents?: Array<{ id: string; title: string }> } | null;
    const snapB = b.snapshotData as { documents?: Array<{ id: string; title: string }> } | null;
    const docsA = new Set((snapA?.documents ?? []).map((d) => d.id));
    const docsB = new Set((snapB?.documents ?? []).map((d) => d.id));

    const added = [...docsB].filter((id) => !docsA.has(id));
    const removed = [...docsA].filter((id) => !docsB.has(id));

    return {
      versionA: { id: a.id, versionNumber: a.versionNumber, scores: this.extractScores(a) },
      versionB: { id: b.id, versionNumber: b.versionNumber, scores: this.extractScores(b) },
      documentChanges: { added: added.length, removed: removed.length },
      scoreDelta: {
        knowledge: (b.knowledgeScore ?? 0) - (a.knowledgeScore ?? 0),
        confidence: (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0),
        readiness: (b.readinessScore ?? 0) - (a.readinessScore ?? 0),
      },
    };
  }

  private extractScores(version: {
    knowledgeScore: number | null;
    confidenceScore: number | null;
    readinessScore: number | null;
    hallucinationRisk: number | null;
  }) {
    return {
      knowledgeScore: version.knowledgeScore,
      confidenceScore: version.confidenceScore,
      readinessScore: version.readinessScore,
      hallucinationRisk: version.hallucinationRisk,
    };
  }

  async rollback(businessId: string, versionId: string, audit: AuditContext) {
    const version = await this.getVersion(businessId, versionId);
    if (version.status !== 'ARCHIVED' && version.status !== 'PRODUCTION') {
      throw new ValidationError('Can only rollback to a previously deployed version');
    }

    const previousProductionId = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-production:${businessId}`}))`;
      const workspace = await tx.aiTrainingWorkspace.findUniqueOrThrow({
        where: { businessId },
        select: { productionVersionId: true },
      });

      if (workspace.productionVersionId && workspace.productionVersionId !== versionId) {
        await tx.aiTrainingVersion.update({
          where: { id: workspace.productionVersionId },
          data: { status: 'ARCHIVED' },
        });
      }
      await tx.aiTrainingVersion.update({
        where: { id: versionId },
        data: { status: 'PRODUCTION' },
      });
      await tx.aiTrainingWorkspace.update({
        where: { businessId },
        data: {
          productionVersionId: versionId,
          sandboxVersionId: versionId,
          aiReadinessScore: version.readinessScore ?? undefined,
          knowledgeScore: version.knowledgeScore ?? undefined,
          confidenceScore: version.confidenceScore ?? undefined,
        },
      });
      return workspace.productionVersionId;
    });
    invalidateKnowledgeCache(businessId);

    await recordAiTrainingAudit(
      { ...audit, businessId, versionId },
      'VERSION_ROLLBACK',
      {
        entity: 'AiTrainingVersion',
        entityId: versionId,
        oldData: { productionVersionId: previousProductionId },
        newData: { productionVersionId: versionId },
      }
    );

    return this.getVersion(businessId, versionId);
  }
}

export const versionService = new VersionService();
