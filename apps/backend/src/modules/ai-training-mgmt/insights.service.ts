import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import type { QualityScores, TrainingSnapshot } from './quality.service';

export class InsightsService {
  async generateInsights(
    businessId: string,
    snapshot: TrainingSnapshot,
    scores: QualityScores
  ): Promise<void> {
    const insights: Array<{
      type: string;
      title: string;
      description: string;
      severity: string;
      metadata?: Record<string, unknown>;
    }> = [];

    if (snapshot.faqCount === 0) {
      insights.push({
        type: 'missing_faq',
        title: 'Missing FAQs',
        description: 'Add frequently asked questions to improve answer accuracy.',
        severity: 'high',
      });
    }

    if (scores.knowledgeCompleteness < 50) {
      insights.push({
        type: 'profile_incomplete',
        title: 'Incomplete Business Profile',
        description: 'Fill in mission, services, pricing, and policies for better AI context.',
        severity: 'high',
        metadata: { completeness: scores.knowledgeCompleteness },
      });
    }

    if (scores.embeddingQuality < 70) {
      insights.push({
        type: 'low_embedding_quality',
        title: 'Low Embedding Quality',
        description: 'Some documents failed embedding. Re-index documents before deployment.',
        severity: 'medium',
        metadata: { quality: scores.embeddingQuality },
      });
    }

    const outdatedDocs = snapshot.documents.filter(
      (d) => d.status !== 'INDEXED' || !d.embedding
    );
    if (outdatedDocs.length > 0) {
      insights.push({
        type: 'outdated_document',
        title: 'Documents Need Processing',
        description: `${outdatedDocs.length} document(s) are not fully indexed.`,
        severity: 'medium',
        metadata: { documentIds: outdatedDocs.map((d) => d.id) },
      });
    }

    if (scores.readinessScore < 60) {
      insights.push({
        type: 'suggested_retraining',
        title: 'Suggested Retraining',
        description: 'AI readiness score is below threshold. Consider adding more knowledge and retraining.',
        severity: 'high',
        metadata: { readinessScore: scores.readinessScore },
      });
    }

    await prisma.aiTrainingInsight.deleteMany({
      where: { businessId, resolvedAt: null },
    });

    if (insights.length > 0) {
      await prisma.aiTrainingInsight.createMany({
        data: insights.map((i) => ({
          businessId,
          type: i.type,
          title: i.title,
          description: i.description,
          severity: i.severity,
          metadata: i.metadata as Prisma.InputJsonValue | undefined,
        })),
      });
    }
  }

  async listInsights(businessId: string) {
    return prisma.aiTrainingInsight.findMany({
      where: { businessId, resolvedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async resolveInsight(businessId: string, insightId: string) {
    return prisma.aiTrainingInsight.updateMany({
      where: { id: insightId, businessId },
      data: { resolvedAt: new Date() },
    });
  }
}

export const insightsService = new InsightsService();
