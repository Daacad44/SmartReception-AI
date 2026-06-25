import { config } from '../../config';
import { logger } from '../../core/logger';
import { prisma } from '../../infrastructure/database/prisma';
import { whatsappMediaService } from '../../infrastructure/whatsapp/whatsapp-media.service';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { broadcastConversationEvent } from '../../infrastructure/realtime/broadcast.service';
import { notifyNewMessage } from '../../infrastructure/notifications/notification-helper';
import {
  isMenuOnlyTrigger,
  parseMenuSelection,
  requestsEnglish,
} from '../../infrastructure/ai/somali-menu';
import { isSmartReceptionBusiness } from '../../infrastructure/ai/smartreception-tenant';
import { buildTenantMenuOptionReply } from '../../infrastructure/ai/business-welcome.service';
import { getCachedBusinessProfile } from '../../infrastructure/ai/business-tenant-cache.service';
import {
  createSalesFlow,
  getActiveSalesFlow,
  invalidateSalesFlowCache,
  processSalesFlowMessage,
  salesFlowMetadata,
} from '../../infrastructure/ai/sales-flow.service';
import type { SalesFlowContext } from '../../infrastructure/ai/sales-flow.types';
import { isAutoReplyEnabled } from '../ai/ai-config.service';
import { processAndSendAiReply } from '../ai/ai-reply.service';
import { sendAutomatedReply, sendServiceMenu } from '../ai/menu-reply.service';
import { recordInboundMessage } from './whatsapp-pipeline-state';
import { whatsappRepository } from './whatsapp.repository';
import type { WhatsAppWebhookMessage } from '../../infrastructure/whatsapp/whatsapp.types';
import {
  logPipelineStep,
  persistPipelineTiming,
  updatePipelineContext,
} from './message-pipeline.logger';

export interface HandleIncomingMessageParams {
  businessId: string;
  whatsappAccountId: string;
  phoneNumberId: string;
  accessToken?: string;
  msg: WhatsAppWebhookMessage;
  contactName?: string;
  pipelineKey: string;
  extracted: {
    type: string;
    content: string;
    mediaId?: string;
    filename?: string;
    metadata?: Record<string, unknown>;
  };
}

function shouldAiRespond(conversation: { isAiEnabled: boolean }): boolean {
  return conversation.isAiEnabled;
}

export async function handleIncomingMessage(params: HandleIncomingMessageParams): Promise<void> {
  const {
    businessId,
    whatsappAccountId,
    phoneNumberId,
    accessToken,
    msg,
    contactName,
    pipelineKey,
    extracted,
  } = params;
  const startedAt = Date.now();
  const timings: Record<string, number> = {};

  const customer = await whatsappRepository.findOrCreateCustomer(
    businessId,
    msg.from,
    contactName ?? msg.from
  );
  timings.customerMs = Date.now() - startedAt;

  const { conversation, isNew } = await whatsappRepository.findOrCreateConversation(
    businessId,
    customer.id,
    whatsappAccountId
  );
  timings.conversationMs = Date.now() - startedAt;

  recordInboundMessage(businessId, extracted.content);

  const message = await whatsappRepository.createInboundMessage({
    conversationId: conversation.id,
    customerId: customer.id,
    content: extracted.content,
    whatsappMsgId: msg.id,
    type: extracted.type,
    metadata: {
      ...(extracted.metadata ?? {}),
      senderName: contactName,
      whatsappTimestamp: msg.timestamp,
    },
  });
  timings.messageSavedMs = Date.now() - startedAt;

  updatePipelineContext(pipelineKey, {
    conversationId: conversation.id,
    messageId: message.id,
  });
  logPipelineStep(pipelineKey, 'message_saved', { timings });

  const aiText = extracted.content?.trim() ?? '';
  const autoReplyEnabled =
    config.aiReply.enabled && (await isAutoReplyEnabled(businessId));
  const canReplyWithAi =
    autoReplyEnabled && shouldAiRespond(conversation) && Boolean(aiText);

  if (canReplyWithAi) {
    logPipelineStep(pipelineKey, 'reply_started');
    const replyStartedAt = Date.now();
    await runSomaliSalesAgent({
      businessId,
      conversationId: conversation.id,
      customerId: customer.id,
      inboundMessageId: message.id,
      customerMessage: aiText,
      phoneNumberId,
      customerPhone: msg.from,
      accessToken,
      preferEnglish: requestsEnglish(aiText),
      pipelineKey,
      isNewConversation: isNew,
    });
    timings.replyMs = Date.now() - replyStartedAt;
    logPipelineStep(pipelineKey, 'reply_sent', { timings });
    persistPipelineTiming(message.id, { ...timings, totalMs: Date.now() - startedAt });
  } else {
    logger.debug('Auto-reply skipped', {
      conversationId: conversation.id,
      autoReplyEnabled,
      isAiEnabled: conversation.isAiEnabled,
      hasText: Boolean(aiText),
    });
    logPipelineStep(pipelineKey, 'deferred_tasks_done');
  }

  // Non-critical work after reply — must not block WhatsApp response time.
  void runDeferredInboundTasks({
    businessId,
    conversationId: conversation.id,
    messageId: message.id,
    customerName: customer.name,
    phoneNumberId,
    whatsappMsgId: msg.id,
    accessToken,
    extracted,
    pipelineKey,
    startedAt,
  });
}

interface DeferredInboundTasksParams {
  businessId: string;
  conversationId: string;
  messageId: string;
  customerName: string;
  phoneNumberId: string;
  whatsappMsgId: string;
  accessToken?: string;
  pipelineKey: string;
  startedAt: number;
  extracted: HandleIncomingMessageParams['extracted'];
}

async function runDeferredInboundTasks(params: DeferredInboundTasksParams): Promise<void> {
  const {
    businessId,
    conversationId,
    messageId,
    customerName,
    phoneNumberId,
    whatsappMsgId,
    accessToken,
    extracted,
    pipelineKey,
    startedAt,
  } = params;

  try {
    await broadcastConversationEvent(businessId, {
      conversationId,
      type: 'message',
    });

    if (extracted.mediaId) {
      if (accessToken) {
        await downloadAndAttachMedia({
          messageId,
          conversationId,
          businessId,
          mediaId: extracted.mediaId,
          filename: extracted.filename,
          token: accessToken,
          baseMetadata: extracted.metadata ?? {},
        });
      } else {
        logger.warn('Skipping media download — no business access token', { messageId });
      }
    }

    whatsappService.markAsRead(phoneNumberId, whatsappMsgId, accessToken).catch((error) => {
      logger.warn('Failed to mark WhatsApp message as read', { error });
    });

    notifyNewMessage(businessId, customerName, conversationId).catch((error) => {
      logger.warn('Failed to send new message notification', { error });
    });

    const { markCampaignResponse } = await import('../campaigns/campaign-webhook-sync.service');
    const customer = await prisma.customer.findFirst({
      where: { businessId, conversations: { some: { id: conversationId } } },
      select: { id: true },
    });
    if (customer) {
      void markCampaignResponse(businessId, customer.id).catch((error) => {
        logger.warn('Failed to mark campaign response', { error });
      });
    }

    prisma.auditLog
      .create({
        data: {
          businessId,
          action: 'CREATE',
          entity: 'WhatsAppMessage',
          entityId: messageId,
          newData: { direction: 'INBOUND', type: extracted.type, from: whatsappMsgId },
        },
      })
      .catch((error) => {
        logger.warn('Failed to write WhatsApp audit log', { error });
      });

    logPipelineStep(pipelineKey, 'deferred_tasks_done', {
      deferredMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error('Deferred inbound tasks failed', { error, conversationId, messageId });
  }
}

interface SomaliSalesAgentParams {
  businessId: string;
  conversationId: string;
  customerId: string;
  inboundMessageId: string;
  customerMessage: string;
  phoneNumberId: string;
  customerPhone: string;
  accessToken?: string;
  preferEnglish?: boolean;
  pipelineKey: string;
  isNewConversation?: boolean;
}

async function runSomaliSalesAgent(params: SomaliSalesAgentParams): Promise<void> {
  const profile = await getCachedBusinessProfile(params.businessId);
  const business = profile.business;

  const isPlatformBusiness = isSmartReceptionBusiness(business);
  const base = {
    businessId: params.businessId,
    conversationId: params.conversationId,
    phoneNumberId: params.phoneNumberId,
    customerPhone: params.customerPhone,
    accessToken: params.accessToken,
  };

  const flowCtx: SalesFlowContext = {
    businessId: params.businessId,
    conversationId: params.conversationId,
    customerId: params.customerId,
    phoneNumberId: params.phoneNumberId,
    customerPhone: params.customerPhone,
    accessToken: params.accessToken,
  };

  if (isPlatformBusiness) {
    const menuReset = /^(menu|adeegyada|bilow|start)$/i.test(params.customerMessage.trim());
    const activeFlow = menuReset
      ? null
      : await getActiveSalesFlow(params.conversationId, params.businessId);

    if (activeFlow) {
      console.log('[AI] Sales flow active', {
        service: activeFlow.serviceOption,
        phase: activeFlow.phase,
      });
      const result = await processSalesFlowMessage(params.customerMessage, activeFlow, flowCtx);
      if (result.handled && result.reply) {
        await sendAutomatedReply({
          ...base,
          content: result.reply,
          metadata: salesFlowMetadata(result.nextState ?? null),
        });
        invalidateSalesFlowCache(params.conversationId, params.businessId);
        logPipelineStep(params.pipelineKey, 'sales_flow_handled', {
          service: activeFlow.serviceOption,
          phase: activeFlow.phase,
        });
        return;
      }
    }

    const menuOption = parseMenuSelection(params.customerMessage);
    if (menuOption !== null && !activeFlow) {
      console.log('[AI] Starting sales consultant flow', { option: menuOption });
      const start = createSalesFlow(menuOption);
      if (start.handled && start.reply) {
        await sendAutomatedReply({
          ...base,
          content: start.reply,
          metadata: salesFlowMetadata(start.nextState ?? null),
        });
        invalidateSalesFlowCache(params.conversationId, params.businessId);
        logPipelineStep(params.pipelineKey, 'sales_flow_handled', { option: menuOption });
        return;
      }
    }
  }

  const tenantMenuOption = !isPlatformBusiness ? parseMenuSelection(params.customerMessage) : null;
  if (tenantMenuOption !== null) {
    const reply = await buildTenantMenuOptionReply(params.businessId, tenantMenuOption);
    if (reply) {
      await sendAutomatedReply({
        ...base,
        content: reply,
        metadata: { type: 'tenant_menu_option', option: tenantMenuOption },
      });
      logPipelineStep(params.pipelineKey, 'tenant_menu_option', { option: tenantMenuOption });
      return;
    }
  }

  if (isMenuOnlyTrigger(params.customerMessage)) {
    console.log('[AI] Greeting — sending business greeting menu', {
      businessId: params.businessId,
      isPlatformBusiness,
      isNewConversation: params.isNewConversation,
    });
    await sendServiceMenu(base);
    logPipelineStep(params.pipelineKey, 'menu_sent');
    return;
  }

  // First contact on a new conversation: greet before AI when message is a short opener.
  if (
    params.isNewConversation &&
    !isPlatformBusiness &&
    params.customerMessage.trim().length <= 30 &&
    !params.customerMessage.includes('?')
  ) {
    console.log('[AI] New conversation — sending business welcome', { businessId: params.businessId });
    await sendServiceMenu(base);
    logPipelineStep(params.pipelineKey, 'new_conversation_welcome');
    return;
  }

  console.log('[AI] Free-form — Knowledge Base + Gemini', { businessId: params.businessId });
  logPipelineStep(params.pipelineKey, 'ai_started');
  await processAndSendAiReply({
    businessId: params.businessId,
    conversationId: params.conversationId,
    inboundMessageId: params.inboundMessageId,
    customerMessage: params.customerMessage,
    phoneNumberId: params.phoneNumberId,
    customerPhone: params.customerPhone,
    accessToken: params.accessToken,
    preferEnglish: params.preferEnglish,
    pipelineKey: params.pipelineKey,
  });
}

async function downloadAndAttachMedia(params: {
  messageId: string;
  conversationId: string;
  businessId: string;
  mediaId: string;
  filename?: string;
  token: string;
  baseMetadata: Record<string, unknown>;
}): Promise<void> {
  const { buffer, mimeType } = await whatsappMediaService.downloadFromMeta(params.mediaId, params.token);
  const stored = await whatsappMediaService.storeInboundMedia(
    buffer,
    mimeType,
    params.businessId,
    params.conversationId,
    params.filename
  );

  await prisma.message.update({
    where: { id: params.messageId },
    data: {
      mediaUrl: stored.url,
      metadata: {
        ...params.baseMetadata,
        mimeType,
        fileSize: stored.fileSize,
        storageKey: stored.key,
        whatsappMediaId: params.mediaId,
      } as object,
    },
  });

  await broadcastConversationEvent(params.businessId, {
    conversationId: params.conversationId,
    type: 'message',
  });
}
