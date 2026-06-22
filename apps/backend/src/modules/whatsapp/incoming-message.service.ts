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
import {
  createSalesFlow,
  getActiveSalesFlow,
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

export interface HandleIncomingMessageParams {
  businessId: string;
  whatsappAccountId: string;
  phoneNumberId: string;
  accessToken?: string;
  msg: WhatsAppWebhookMessage;
  contactName?: string;
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
    extracted,
  } = params;
  const startedAt = Date.now();

  const customer = await whatsappRepository.findOrCreateCustomer(
    businessId,
    msg.from,
    contactName ?? msg.from
  );

  const { conversation } = await whatsappRepository.findOrCreateConversation(
    businessId,
    customer.id,
    whatsappAccountId
  );

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

  await broadcastConversationEvent(businessId, {
    conversationId: conversation.id,
    type: 'message',
  });

  const aiText = extracted.content?.trim() ?? '';
  const autoReplyEnabled =
    config.aiReply.enabled && (await isAutoReplyEnabled(businessId));
  const canReplyWithAi =
    autoReplyEnabled && shouldAiRespond(conversation) && Boolean(aiText);

  if (canReplyWithAi) {
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
    });
  } else {
    logger.debug('Auto-reply skipped', {
      conversationId: conversation.id,
      autoReplyEnabled,
      isAiEnabled: conversation.isAiEnabled,
      hasText: Boolean(aiText),
    });
  }

  if (extracted.mediaId) {
    const token = accessToken || config.whatsapp.accessToken;
    if (token) {
      void downloadAndAttachMedia({
        messageId: message.id,
        conversationId: conversation.id,
        businessId,
        mediaId: extracted.mediaId,
        filename: extracted.filename,
        token,
        baseMetadata: extracted.metadata ?? {},
      }).catch((error) => logger.error('Failed to download/store WhatsApp media:', error));
    }
  }

  whatsappService.markAsRead(phoneNumberId, msg.id, accessToken).catch((error) => {
    logger.warn('Failed to mark WhatsApp message as read', { error });
  });

  notifyNewMessage(businessId, customer.name, conversation.id).catch((error) => {
    logger.warn('Failed to send new message notification', { error });
  });

  prisma.auditLog
    .create({
      data: {
        businessId,
        action: 'CREATE',
        entity: 'WhatsAppMessage',
        entityId: message.id,
        newData: { direction: 'INBOUND', type: extracted.type, from: msg.from },
      },
    })
    .catch((error) => {
      logger.warn('Failed to write WhatsApp audit log', { error });
    });

  console.log(`[WhatsApp] handleIncomingMessage completed in ${Date.now() - startedAt}ms`);
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
}

async function runSomaliSalesAgent(params: SomaliSalesAgentParams): Promise<void> {
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

  const menuReset = /^(menu|adeegyada|bilow|start)$/i.test(params.customerMessage.trim());
  const activeFlow = menuReset ? null : await getActiveSalesFlow(params.conversationId);

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
      return;
    }
  }

  await sendServiceMenu(base);

  if (isMenuOnlyTrigger(params.customerMessage)) {
    console.log('[AI] Greeting — menu sent, awaiting selection');
    return;
  }

  console.log('[AI] Free-form — Knowledge Base + Gemini (Somali sales consultant)');
  await processAndSendAiReply({
    businessId: params.businessId,
    conversationId: params.conversationId,
    inboundMessageId: params.inboundMessageId,
    customerMessage: params.customerMessage,
    phoneNumberId: params.phoneNumberId,
    customerPhone: params.customerPhone,
    accessToken: params.accessToken,
    preferEnglish: params.preferEnglish,
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
