import { Prisma, type AiAgentExecutionStatus } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../core/logger';
import { ValidationError } from '../../core/errors';
import { prisma } from '../../infrastructure/database/prisma';
import { aiService } from '../../infrastructure/ai/conversation-ai.service';
import type { AIAction, AIResponse } from '../../infrastructure/ai/ai.types';
import type { RagPipelineMeta } from '../../infrastructure/ai/rag/rag-pipeline.service';
import { agentActionService } from './agent-action.service';

interface RuntimeInput {
  businessId: string;
  conversationId: string;
  inboundMessageId: string;
  customerMessage: string;
  customerId: string;
  preferEnglish?: boolean;
  isFirstCustomerMessage?: boolean;
}

interface StoredRuntimeResponse extends AIResponse { _meta?: RagPipelineMeta }
const inputJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const HANDOVER = {
  so: 'Waan ka xumahay, xog la xaqiijiyey oo ku filan uma hayo jawaabtan. Waxaan kuu gudbinayaa shaqaalaha ganacsiga si ay si sax ah kuugu caawiyaan.',
  en: 'I do not have enough verified information to answer safely. I will hand this conversation to the business team for an accurate response.',
};

export function enforceRuntimePolicy(
  response: StoredRuntimeResponse,
  skills: Array<{ skillKey: string; enabled: boolean; requiresConfirmation: boolean }>,
  preferEnglish: boolean
): { response: StoredRuntimeResponse; status: AiAgentExecutionStatus; blockedActions: string[] } {
  const meta = response._meta;
  const unsafeGrounding = Boolean(meta?.missingKnowledge) || (meta?.hallucinationRisk ?? 0) > 0.55 || response.confidence < 0.3;
  if (unsafeGrounding) {
    return {
      response: { ...response, content: preferEnglish ? HANDOVER.en : HANDOVER.so, actions: [{ type: 'escalate' }], confidence: Math.min(response.confidence, 0.2) },
      status: 'HANDED_OVER',
      blockedActions: response.actions.map((action) => action.type).filter((type) => type !== 'none'),
    };
  }

  const allowed = new Map(skills.filter((skill) => skill.enabled).map((skill) => [skill.skillKey, skill]));
  const blockedActions: string[] = [];
  const actions = response.actions.filter((action) => {
    if (action.type !== 'book_appointment') return true;
    const skill = allowed.get('appointment.create');
    if (!skill || skill.requiresConfirmation) { blockedActions.push(action.type); return false; }
    return true;
  });
  if (blockedActions.length) actions.push({ type: 'escalate' });
  return { response: { ...response, actions: actions as AIAction[] }, status: blockedActions.length ? 'HANDED_OVER' : 'COMPLETED', blockedActions };
}

export class AgentRuntimeService {
  async execute(input: RuntimeInput): Promise<{ response: StoredRuntimeResponse; executionId?: string; runtime: 'AGENT_STUDIO' | 'LEGACY'; reused?: boolean }> {
    if (!config.features.agentStudioV2) {
      return { response: await this.generateLegacy(input), runtime: 'LEGACY' };
    }

    const existing = await prisma.aiAgentExecution.findUnique({ where: { inboundMessageId: input.inboundMessageId } });
    if (existing?.response && ['COMPLETED', 'HANDED_OVER'].includes(existing.status)) {
      return { response: existing.response as unknown as StoredRuntimeResponse, executionId: existing.id, runtime: 'AGENT_STUDIO', reused: true };
    }

    const agent = await prisma.aiAgent.findFirst({
      where: { businessId: input.businessId, channel: 'WHATSAPP', status: 'ACTIVE', activeRelease: { status: 'ACTIVE' } },
      include: { activeRelease: true, skills: true },
    });
    if (!agent?.activeRelease) return { response: await this.generateLegacy(input), runtime: 'LEGACY' };

    const knowledge = await prisma.aiAgentKnowledgeSource.findMany({
      where: { agentId: agent.id, status: 'APPROVED', OR: [{ freshnessDueAt: null }, { freshnessDueAt: { gte: new Date() } }] },
      select: { documentId: true },
    });
    let execution;
    if (existing?.status === 'RUNNING' && existing.startedAt > new Date(Date.now() - 120_000)) {
      throw new ValidationError('Agent execution is already in progress');
    }
    try {
      execution = existing
        ? await prisma.aiAgentExecution.update({ where: { id: existing.id }, data: { status: 'RUNNING', agentId: agent.id, releaseId: agent.activeRelease.id, error: null, completedAt: null, startedAt: new Date() } })
        : await prisma.aiAgentExecution.create({ data: { businessId: input.businessId, agentId: agent.id, releaseId: agent.activeRelease.id, conversationId: input.conversationId, inboundMessageId: input.inboundMessageId, input: inputJson({ message: input.customerMessage, channel: 'WHATSAPP' }) } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await prisma.aiAgentExecution.findUnique({ where: { inboundMessageId: input.inboundMessageId } });
        if (raced?.response && ['COMPLETED', 'HANDED_OVER'].includes(raced.status)) return { response: raced.response as unknown as StoredRuntimeResponse, executionId: raced.id, runtime: 'AGENT_STUDIO', reused: true };
        throw new ValidationError('Agent execution is already in progress');
      }
      throw error;
    }

    const startedAt = Date.now();
    try {
      const confirmationResponse = await agentActionService.handleCustomerConfirmation({
        businessId: input.businessId,
        conversationId: input.conversationId,
        customerId: input.customerId,
        message: input.customerMessage,
        preferEnglish: input.preferEnglish === true,
      });
      if (confirmationResponse) {
        await prisma.aiAgentExecution.update({ where: { id: execution.id }, data: { status: 'COMPLETED', intent: confirmationResponse.intent, response: inputJson(confirmationResponse), proposedActions: inputJson([]), executedActions: inputJson([]), confidence: confirmationResponse.confidence, latencyMs: Date.now() - startedAt, completedAt: new Date() } });
        return { response: confirmationResponse, executionId: execution.id, runtime: 'AGENT_STUDIO' };
      }
      const snapshot = agent.activeRelease.snapshotData as Record<string, unknown>;
      const draft = (snapshot.draft ?? {}) as Record<string, unknown>;
      const response = await aiService.generateResponse(input.businessId, input.conversationId, input.customerMessage, {
        preferEnglish: input.preferEnglish,
        isFirstCustomerMessage: input.isFirstCustomerMessage,
        customerId: input.customerId,
        messageId: input.inboundMessageId,
        documentIds: knowledge.map((source) => source.documentId),
        agentInstructions: (draft.instructions ?? {}) as Record<string, unknown>,
      });
      const appointmentAction = response.actions.find((action) => action.type === 'book_appointment');
      const appointmentSkill = agent.skills.find((skill) => skill.skillKey === 'appointment.create');
      let governed = enforceRuntimePolicy(response, agent.skills, input.preferEnglish === true);
      if (appointmentAction && appointmentSkill?.enabled && !response._meta?.missingKnowledge && response.confidence >= 0.3) {
        const proposal = await agentActionService.proposeAppointment({ businessId: input.businessId, conversationId: input.conversationId, executionId: execution.id, action: appointmentAction, preferEnglish: input.preferEnglish === true });
        governed = { response: { ...response, content: proposal.confirmationPrompt ?? response.content, actions: [{ type: 'none' }] }, status: 'COMPLETED', blockedActions: ['book_appointment:awaiting_confirmation'] };
      }
      await prisma.aiAgentExecution.update({ where: { id: execution.id }, data: { status: governed.status, intent: governed.response.intent, response: inputJson(governed.response), retrievedSources: inputJson(governed.response._meta?.chunks ?? []), proposedActions: inputJson(response.actions), executedActions: inputJson(governed.response.actions), confidence: governed.response.confidence, latencyMs: Date.now() - startedAt, completedAt: new Date(), error: governed.blockedActions.length ? `Blocked actions: ${governed.blockedActions.join(', ')}` : null } });
      return { response: governed.response, executionId: execution.id, runtime: 'AGENT_STUDIO' };
    } catch (error) {
      await prisma.aiAgentExecution.update({ where: { id: execution.id }, data: { status: 'FAILED', latencyMs: Date.now() - startedAt, completedAt: new Date(), error: error instanceof Error ? error.message : String(error) } }).catch(() => undefined);
      logger.error('Agent Studio runtime execution failed', { executionId: execution.id, businessId: input.businessId, error });
      throw error;
    }
  }

  private generateLegacy(input: RuntimeInput) {
    return aiService.generateResponse(input.businessId, input.conversationId, input.customerMessage, { preferEnglish: input.preferEnglish, isFirstCustomerMessage: input.isFirstCustomerMessage, customerId: input.customerId, messageId: input.inboundMessageId });
  }
}

export const agentRuntimeService = new AgentRuntimeService();
