import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../core/errors';

/**
 * Knowledge-gap detection (Phases 9 & 10).
 *
 * Every question the AI could not answer from the approved knowledge base is
 * recorded here. Recurring questions increment `frequency` instead of creating
 * duplicates, so Super Admin sees the highest-impact gaps first and can retrain.
 */
export class KnowledgeGapService {
  private normalize(question: string): string {
    return question
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);
  }

  private recommend(category?: string | null, intent?: string | null): string {
    switch (intent) {
      case 'pricing':
        return 'Add a pricing document or FAQ covering this cost question.';
      case 'services':
        return 'Add this service (name, description, price) to the Services library.';
      case 'booking':
        return 'Confirm working hours, appointment settings and availability cover this request.';
      case 'support':
        return 'Add a policy or FAQ entry that answers this support question.';
      default:
        return category
          ? `Add knowledge under "${category}" that answers this question.`
          : 'Add a knowledge document or FAQ that answers this question.';
    }
  }

  /** Record (or increment) a missing-knowledge report. Idempotent per normalized question. */
  async record(input: {
    businessId: string;
    versionId?: string;
    sessionId?: string;
    question: string;
    category?: string | null;
    intent?: string | null;
    groundedConfidence?: number | null;
    hallucinationRisk?: number | null;
    source?: string;
  }) {
    const normalizedQuestion = this.normalize(input.question);
    if (!normalizedQuestion) return null;

    const recommendation = this.recommend(input.category, input.intent);

    return prisma.aiKnowledgeGap.upsert({
      where: {
        businessId_normalizedQuestion: {
          businessId: input.businessId,
          normalizedQuestion,
        },
      },
      create: {
        businessId: input.businessId,
        versionId: input.versionId,
        sessionId: input.sessionId,
        question: input.question.slice(0, 1000),
        normalizedQuestion,
        category: input.category ?? undefined,
        intent: input.intent ?? undefined,
        groundedConfidence: input.groundedConfidence ?? undefined,
        hallucinationRisk: input.hallucinationRisk ?? undefined,
        recommendation,
        source: input.source ?? 'SANDBOX',
      },
      update: {
        frequency: { increment: 1 },
        lastAskedAt: new Date(),
        status: 'OPEN',
        versionId: input.versionId ?? undefined,
        sessionId: input.sessionId ?? undefined,
        groundedConfidence: input.groundedConfidence ?? undefined,
        hallucinationRisk: input.hallucinationRisk ?? undefined,
      },
    });
  }

  async list(
    businessId: string,
    opts: { status?: 'OPEN' | 'RESOLVED' | 'DISMISSED'; limit?: number } = {}
  ) {
    const where: Prisma.AiKnowledgeGapWhereInput = { businessId };
    if (opts.status) where.status = opts.status;
    return prisma.aiKnowledgeGap.findMany({
      where,
      orderBy: [{ status: 'asc' }, { frequency: 'desc' }, { lastAskedAt: 'desc' }],
      take: opts.limit ?? 100,
    });
  }

  async summary(businessId: string) {
    const [open, resolved, total, topOpen] = await Promise.all([
      prisma.aiKnowledgeGap.count({ where: { businessId, status: 'OPEN' } }),
      prisma.aiKnowledgeGap.count({ where: { businessId, status: 'RESOLVED' } }),
      prisma.aiKnowledgeGap.count({ where: { businessId } }),
      prisma.aiKnowledgeGap.findMany({
        where: { businessId, status: 'OPEN' },
        orderBy: [{ frequency: 'desc' }, { lastAskedAt: 'desc' }],
        take: 5,
      }),
    ]);
    return { open, resolved, total, topOpen };
  }

  async updateStatus(
    businessId: string,
    gapId: string,
    status: 'OPEN' | 'RESOLVED' | 'DISMISSED',
    userId?: string
  ) {
    const gap = await prisma.aiKnowledgeGap.findFirst({ where: { id: gapId, businessId } });
    if (!gap) throw new NotFoundError('Knowledge gap not found');
    return prisma.aiKnowledgeGap.update({
      where: { id: gapId },
      data: {
        status,
        resolvedByUserId: status === 'RESOLVED' ? userId : undefined,
        resolvedAt: status === 'RESOLVED' ? new Date() : null,
      },
    });
  }
}

export const knowledgeGapService = new KnowledgeGapService();
