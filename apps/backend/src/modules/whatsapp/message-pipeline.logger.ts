import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../core/logger';

export type PipelineStep =
  | 'webhook_received'
  | 'message_saved'
  | 'reply_started'
  | 'menu_sent'
  | 'new_conversation_welcome'
  | 'tenant_menu_option'
  | 'sales_flow_handled'
  | 'ai_started'
  | 'ai_finished'
  | 'reply_sent'
  | 'reply_failed'
  | 'deferred_tasks_done';

interface PipelineContext {
  businessId: string;
  conversationId?: string;
  messageId?: string;
  whatsappMsgId?: string;
  receivedAt?: number;
}

const contexts = new Map<string, PipelineContext>();

export function startPipelineTrace(
  key: string,
  ctx: PipelineContext
): void {
  contexts.set(key, { ...ctx, receivedAt: ctx.receivedAt ?? Date.now() });
  logStep(key, 'webhook_received', { ...ctx });
}

export function updatePipelineContext(
  key: string,
  patch: Partial<PipelineContext>
): void {
  const existing = contexts.get(key);
  if (!existing) return;
  contexts.set(key, { ...existing, ...patch });
}

export function logPipelineStep(
  key: string,
  step: PipelineStep,
  extra?: Record<string, unknown>
): void {
  logStep(key, step, extra);
}

function logStep(key: string, step: PipelineStep, extra?: Record<string, unknown>): void {
  const ctx = contexts.get(key);
  const elapsedMs = ctx?.receivedAt ? Date.now() - ctx.receivedAt : undefined;
  const payload = {
    step,
    elapsedMs,
    businessId: ctx?.businessId,
    conversationId: ctx?.conversationId,
    messageId: ctx?.messageId,
    whatsappMsgId: ctx?.whatsappMsgId,
    ...extra,
  };

  console.log(`[Pipeline] ${step}`, payload);
  logger.info(`[Pipeline] ${step}`, payload);

  if (step === 'reply_sent' || step === 'reply_failed' || step === 'deferred_tasks_done') {
    contexts.delete(key);
  }
}

export function persistPipelineTiming(
  messageId: string,
  timings: Record<string, number>
): void {
  void (async () => {
    try {
      const existing = await prisma.message.findUnique({
        where: { id: messageId },
        select: { metadata: true },
      });
      const meta = (existing?.metadata as Record<string, unknown> | null) ?? {};
      await prisma.message.update({
        where: { id: messageId },
        data: {
          metadata: {
            ...meta,
            pipelineTimings: timings,
            pipelineCompletedAt: new Date().toISOString(),
          } as object,
        },
      });
    } catch (error) {
      logger.warn('Failed to persist pipeline timings', { error, messageId });
    }
  })();
}
