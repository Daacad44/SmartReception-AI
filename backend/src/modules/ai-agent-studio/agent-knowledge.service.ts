import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError } from '../../core/errors';
import type { AttachAgentKnowledgeInput, ReviewAgentKnowledgeInput } from './ai-agent-studio.schemas';

const json = (value: Record<string, unknown>): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export function knowledgeChecksum(document: { title: string; content: string | null; question: string | null; answer: string | null }) {
  return createHash('sha256').update(JSON.stringify(document)).digest('hex');
}

export class AgentKnowledgeService {
  async list(businessId: string, agentId: string) {
    const sources = await prisma.aiAgentKnowledgeSource.findMany({
      where: { businessId, agentId, status: { not: 'ARCHIVED' } },
      include: { document: { select: { id: true, title: true, type: true, status: true, category: true, updatedAt: true } }, revisions: { orderBy: { version: 'desc' }, take: 1 } },
      orderBy: { updatedAt: 'desc' },
    });
    const now = new Date();
    return {
      sources,
      summary: {
        total: sources.length,
        approved: sources.filter((source) => source.status === 'APPROVED').length,
        pending: sources.filter((source) => source.status === 'PENDING_REVIEW').length,
        stale: sources.filter((source) => source.status === 'STALE' || (source.freshnessDueAt && source.freshnessDueAt < now)).length,
      },
    };
  }

  async attach(businessId: string, agentId: string, input: AttachAgentKnowledgeInput, userId?: string) {
    const [agent, document] = await Promise.all([
      prisma.aiAgent.findFirst({ where: { id: agentId, businessId } }),
      prisma.knowledgeDocument.findFirst({ where: { id: input.documentId, knowledgeBase: { businessId } } }),
    ]);
    if (!agent || !document) throw new NotFoundError('Agent or knowledge document not found');
    if (document.status !== 'INDEXED') throw new ValidationError('Only successfully indexed knowledge can be attached');
    const checksum = knowledgeChecksum(document);
    const duplicate = await prisma.aiAgentKnowledgeSource.findFirst({ where: { agentId, contentChecksum: checksum } });
    if (duplicate && duplicate.documentId !== document.id) throw new ValidationError('This knowledge content is already attached');
    const freshnessDueAt = new Date(Date.now() + input.freshnessDays * 86_400_000);

    return prisma.$transaction(async (tx) => {
      const source = await tx.aiAgentKnowledgeSource.upsert({
        where: { agentId_documentId: { agentId, documentId: document.id } },
        create: { businessId, agentId, documentId: document.id, contentChecksum: checksum, freshnessDueAt, revisions: { create: { version: 1, contentChecksum: checksum, createdByUserId: userId, snapshotData: json({ title: document.title, content: document.content, question: document.question, answer: document.answer, category: document.category }) } } },
        update: { status: 'PENDING_REVIEW', contentChecksum: checksum, freshnessDueAt, sourceVersion: { increment: 1 }, reviewNotes: null, approvedAt: null },
      });
      const revisionExists = await tx.aiAgentKnowledgeRevision.findUnique({ where: { sourceId_version: { sourceId: source.id, version: source.sourceVersion } } });
      if (!revisionExists) await tx.aiAgentKnowledgeRevision.create({ data: { sourceId: source.id, version: source.sourceVersion, contentChecksum: checksum, createdByUserId: userId, snapshotData: json({ title: document.title, content: document.content, question: document.question, answer: document.answer, category: document.category }) } });
      await tx.auditLog.create({ data: { businessId, userId, action: 'CREATE', entity: 'AiAgentKnowledgeSource', entityId: source.id, newData: json({ documentId: document.id, checksum, version: source.sourceVersion }) } });
      return source;
    });
  }

  async review(businessId: string, agentId: string, sourceId: string, input: ReviewAgentKnowledgeInput, userId?: string) {
    const source = await prisma.aiAgentKnowledgeSource.findFirst({ where: { id: sourceId, businessId, agentId } });
    if (!source) throw new NotFoundError('Agent knowledge source not found');
    return prisma.$transaction(async (tx) => {
      const reviewed = await tx.aiAgentKnowledgeSource.update({ where: { id: sourceId }, data: { status: input.decision, reviewNotes: input.reviewNotes, approvedByUserId: input.decision === 'APPROVED' ? userId : null, approvedAt: input.decision === 'APPROVED' ? new Date() : null, lastVerifiedAt: new Date(), freshnessDueAt: input.decision === 'APPROVED' ? new Date(Date.now() + input.freshnessDays * 86_400_000) : source.freshnessDueAt } });
      await tx.auditLog.create({ data: { businessId, userId, action: 'UPDATE', entity: 'AiAgentKnowledgeSource', entityId: sourceId, newData: json({ decision: input.decision, reviewNotes: input.reviewNotes }) } });
      return reviewed;
    });
  }
}

export const agentKnowledgeService = new AgentKnowledgeService();
