import { Prisma, type AiHandoffPriority, type ConversationTeam } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError } from '../../core/errors';

const ACTIVE_HANDOFF_STATUSES = ['OPEN', 'ACKNOWLEDGED'] as const;
const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export function handoffPriority(reason: string, executionStatus?: string | null): AiHandoffPriority {
  if (/emergency|urgent|degdeg|danger|unsafe|suicide|fire|bleeding/i.test(reason)) return 'URGENT';
  if (executionStatus === 'HANDED_OVER' || /low confidence|missing knowledge|hallucination/i.test(reason)) return 'HIGH';
  return 'NORMAL';
}

function slaMinutes(priority: AiHandoffPriority) {
  if (priority === 'URGENT') return 5;
  if (priority === 'HIGH') return 15;
  return 30;
}

export class HandoffOperationsService {
  async open(params: { businessId: string; conversationId: string; reason: string; assignedToUserId?: string | null; assignedTeam?: ConversationTeam | null }) {
    const [messages, execution] = await Promise.all([
      prisma.message.findMany({ where: { conversationId: params.conversationId }, select: { direction: true, content: true, createdAt: true, isAiGenerated: true }, orderBy: { createdAt: 'desc' }, take: 12 }),
      prisma.aiAgentExecution.findFirst({ where: { businessId: params.businessId, conversationId: params.conversationId }, orderBy: { startedAt: 'desc' } }),
    ]);
    const priority = handoffPriority(params.reason, execution?.status);
    const existing = await prisma.aiHandoffCase.findFirst({ where: { businessId: params.businessId, conversationId: params.conversationId, status: { in: [...ACTIVE_HANDOFF_STATUSES] } } });
    const contextSnapshot = {
      reason: params.reason,
      messages: messages.reverse(),
      agentExecution: execution ? { id: execution.id, releaseId: execution.releaseId, intent: execution.intent, confidence: execution.confidence, retrievedSources: execution.retrievedSources, proposedActions: execution.proposedActions, error: execution.error } : null,
    };
    if (existing) {
      return prisma.aiHandoffCase.update({ where: { id: existing.id }, data: { reason: params.reason, priority, contextSnapshot: json(contextSnapshot), assignedToUserId: params.assignedToUserId ?? existing.assignedToUserId, assignedTeam: params.assignedTeam ?? existing.assignedTeam } });
    }
    try {
      return await prisma.aiHandoffCase.create({ data: { businessId: params.businessId, conversationId: params.conversationId, agentExecutionId: execution?.id, reason: params.reason, priority, contextSnapshot: json(contextSnapshot), assignedToUserId: params.assignedToUserId, assignedTeam: params.assignedTeam, slaDueAt: new Date(Date.now() + slaMinutes(priority) * 60_000) } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return prisma.aiHandoffCase.findFirstOrThrow({ where: { businessId: params.businessId, conversationId: params.conversationId, status: { in: [...ACTIVE_HANDOFF_STATUSES] } } });
      }
      throw error;
    }
  }

  async acknowledge(businessId: string, conversationId: string, userId: string) {
    const active = await this.active(businessId, conversationId);
    if (!active) throw new NotFoundError('Active handoff case not found');
    return prisma.aiHandoffCase.update({ where: { id: active.id }, data: { status: 'ACKNOWLEDGED', assignedToUserId: userId, acknowledgedAt: active.acknowledgedAt ?? new Date(), acknowledgedById: active.acknowledgedById ?? userId } });
  }

  async syncAssignment(businessId: string, conversationId: string, assignedToUserId?: string | null, assignedTeam?: ConversationTeam | null) {
    const active = await this.active(businessId, conversationId);
    if (!active) return null;
    return prisma.aiHandoffCase.update({ where: { id: active.id }, data: { assignedToUserId, assignedTeam } });
  }

  async resolve(businessId: string, conversationId: string, userId: string | null | undefined, summary: string) {
    const active = await this.active(businessId, conversationId);
    if (!active) return null;
    return prisma.aiHandoffCase.update({ where: { id: active.id }, data: { status: 'RESOLVED', resolutionSummary: summary, resolvedAt: new Date(), resolvedById: userId } });
  }

  async resumeAi(businessId: string, conversationId: string, userId: string, summary: string) {
    if (summary.trim().length < 10) throw new ValidationError('AI resume requires a context summary of at least 10 characters');
    const active = await this.active(businessId, conversationId);
    if (!active || active.status !== 'ACKNOWLEDGED') throw new ValidationError('Handoff must be acknowledged before AI can resume');
    if (active.assignedToUserId && active.assignedToUserId !== userId) throw new ValidationError('Only the assigned operator can return this conversation to AI');
    return prisma.aiHandoffCase.update({ where: { id: active.id }, data: { status: 'AI_RESUMED', aiResumeSummary: summary.trim(), aiResumedAt: new Date(), aiResumedById: userId, resolvedAt: new Date(), resolvedById: userId } });
  }

  active(businessId: string, conversationId: string) {
    return prisma.aiHandoffCase.findFirst({ where: { businessId, conversationId, status: { in: [...ACTIVE_HANDOFF_STATUSES] } }, orderBy: { createdAt: 'desc' } });
  }

  async queue(businessId: string, userId?: string) {
    const now = new Date();
    const cases = await prisma.aiHandoffCase.findMany({ where: { businessId, status: { in: [...ACTIVE_HANDOFF_STATUSES] }, ...(userId ? { OR: [{ assignedToUserId: userId }, { assignedToUserId: null }] } : {}) }, include: { conversation: { include: { customer: { select: { id: true, name: true, phone: true } }, assignedTo: { select: { id: true, firstName: true, lastName: true } } } } }, orderBy: [{ priority: 'desc' }, { slaDueAt: 'asc' }] });
    return cases.map((item) => ({ ...item, slaBreached: item.slaDueAt < now, remainingSeconds: Math.max(0, Math.floor((item.slaDueAt.getTime() - now.getTime()) / 1000)) }));
  }
}

export const handoffOperationsService = new HandoffOperationsService();
