import { Prisma, type AiAgentAction } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { ValidationError } from '../../core/errors';
import type { AIAction, AIResponse } from '../../infrastructure/ai/ai.types';

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const CONFIRMATION_WINDOW_MS = 15 * 60 * 1000;

export type ConfirmationDecision = 'CONFIRM' | 'CANCEL' | null;

export function parseActionConfirmation(message: string): ConfirmationDecision {
  const normalized = message.trim().toLowerCase().replace(/[.!?]+$/g, '');
  if (/^(yes|confirm|confirmed|ok|okay|haa|haye|xaqiiji|waan xaqiijinayaa)$/.test(normalized)) return 'CONFIRM';
  if (/^(no|cancel|stop|maya|jooji|ka noqo|kanoqo)$/.test(normalized)) return 'CANCEL';
  return null;
}

function appointmentPayload(action: AIAction) {
  const data = action.data ?? {};
  const startTime = typeof data.startTime === 'string' ? new Date(data.startTime) : null;
  const endTime = typeof data.endTime === 'string' ? new Date(data.endTime) : null;
  if (!startTime || !endTime || Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime || startTime <= new Date()) {
    throw new ValidationError('Appointment proposal requires valid future start and end times');
  }
  return { title: typeof data.title === 'string' ? data.title.slice(0, 200) : 'WhatsApp Appointment', startTime: startTime.toISOString(), endTime: endTime.toISOString() };
}

export class AgentActionService {
  async recordLeadCapture(params: { businessId: string; conversationId: string; executionId: string; customerId: string; payload: Record<string, unknown> }) {
    return prisma.aiAgentAction.upsert({
      where: { idempotencyKey: `${params.executionId}:lead.capture` },
      create: { businessId: params.businessId, conversationId: params.conversationId, executionId: params.executionId, type: 'LEAD_CAPTURE', status: 'COMPLETED', idempotencyKey: `${params.executionId}:lead.capture`, payload: json(params.payload), result: json({ customerId: params.customerId }), requiresConfirmation: false, confirmedAt: new Date(), confirmedBy: 'POLICY', executedAt: new Date() },
      update: {},
    });
  }

  async proposeAppointment(params: { businessId: string; conversationId: string; executionId: string; action: AIAction; preferEnglish: boolean }) {
    const payload = appointmentPayload(params.action);
    const existing = await prisma.aiAgentAction.findFirst({ where: { businessId: params.businessId, conversationId: params.conversationId, type: 'APPOINTMENT_CREATE', status: 'AWAITING_CONFIRMATION' } });
    if (existing) return existing;
    const prompt = params.preferEnglish
      ? `Please confirm this appointment: ${payload.title}, ${new Date(payload.startTime).toLocaleString('en-GB')}. Reply “confirm” or “cancel”.`
      : `Fadlan xaqiiji ballantan: ${payload.title}, ${new Date(payload.startTime).toLocaleString('en-GB')}. Ku jawaab “haa” ama “maya”.`;
    return prisma.aiAgentAction.create({ data: { businessId: params.businessId, conversationId: params.conversationId, executionId: params.executionId, type: 'APPOINTMENT_CREATE', status: 'AWAITING_CONFIRMATION', idempotencyKey: `${params.executionId}:appointment.create`, payload: json(payload), requiresConfirmation: true, confirmationPrompt: prompt, confirmationDueAt: new Date(Date.now() + CONFIRMATION_WINDOW_MS) } });
  }

  async handleCustomerConfirmation(params: { businessId: string; conversationId: string; customerId: string; message: string; preferEnglish: boolean }): Promise<AIResponse | null> {
    const decision = parseActionConfirmation(params.message);
    if (!decision) return null;
    const pending = await prisma.aiAgentAction.findFirst({ where: { businessId: params.businessId, conversationId: params.conversationId, status: 'AWAITING_CONFIRMATION' }, orderBy: { proposedAt: 'desc' } });
    if (!pending) return null;
    if (!pending.confirmationDueAt || pending.confirmationDueAt < new Date()) {
      await prisma.aiAgentAction.update({ where: { id: pending.id }, data: { status: 'EXPIRED', failureReason: 'Confirmation window expired' } });
      return { content: params.preferEnglish ? 'That confirmation request has expired. Please ask me to start again.' : 'Codsigii xaqiijinta waqtigiisii wuu dhammaaday. Fadlan mar kale bilow codsiga.', intent: 'booking', actions: [{ type: 'none' }], confidence: 1, language: params.preferEnglish ? 'en' : 'so' };
    }
    if (decision === 'CANCEL') {
      await prisma.aiAgentAction.update({ where: { id: pending.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), confirmedBy: 'CUSTOMER' } });
      return { content: params.preferEnglish ? 'The action was cancelled. Nothing was changed.' : 'Codsiga waa la joojiyay. Wax isbeddel ah lama samayn.', intent: 'booking', actions: [{ type: 'none' }], confidence: 1, language: params.preferEnglish ? 'en' : 'so' };
    }
    return this.executeAppointment(pending, params.customerId, params.preferEnglish);
  }

  private async executeAppointment(action: AiAgentAction, customerId: string, preferEnglish: boolean): Promise<AIResponse> {
    const claimed = await prisma.aiAgentAction.updateMany({ where: { id: action.id, status: 'AWAITING_CONFIRMATION' }, data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedBy: 'CUSTOMER' } });
    if (claimed.count !== 1) throw new ValidationError('This action was already confirmed or cancelled');
    const payload = action.payload as { title: string; startTime: string; endTime: string };
    try {
      const appointment = await prisma.$transaction(async (tx) => {
        await tx.aiAgentAction.update({ where: { id: action.id }, data: { status: 'EXECUTING' } });
        const overlap = await tx.appointment.count({ where: { businessId: action.businessId, status: { in: ['PENDING', 'SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] }, startTime: { lt: new Date(payload.endTime) }, endTime: { gt: new Date(payload.startTime) } } });
        if (overlap > 0) throw new ValidationError('The requested appointment time is no longer available');
        const created = await tx.appointment.create({ data: { businessId: action.businessId, customerId, title: payload.title, startTime: new Date(payload.startTime), endTime: new Date(payload.endTime), status: 'SCHEDULED' } });
        await tx.aiAgentAction.update({ where: { id: action.id }, data: { status: 'COMPLETED', result: json({ appointmentId: created.id }), executedAt: new Date() } });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return { content: preferEnglish ? `Confirmed. Your appointment is booked for ${appointment.startTime.toLocaleString('en-GB')}.` : `Waa la xaqiijiyay. Ballantaada waxaa la qabtay ${appointment.startTime.toLocaleString('en-GB')}.`, intent: 'booking', actions: [{ type: 'none' }], confidence: 1, language: preferEnglish ? 'en' : 'so' };
    } catch (error) {
      await prisma.aiAgentAction.update({ where: { id: action.id }, data: { status: 'FAILED', failedAt: new Date(), failureReason: error instanceof Error ? error.message : String(error) } }).catch(() => undefined);
      throw error;
    }
  }

  list(businessId: string, conversationId?: string) {
    return prisma.aiAgentAction.findMany({ where: { businessId, ...(conversationId ? { conversationId } : {}) }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
}

export const agentActionService = new AgentActionService();
