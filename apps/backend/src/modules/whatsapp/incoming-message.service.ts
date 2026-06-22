import { config } from '../../config';
import { logger } from '../../core/logger';
import { prisma } from '../../infrastructure/database/prisma';
import { whatsappMediaService } from '../../infrastructure/whatsapp/whatsapp-media.service';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { broadcastConversationEvent } from '../../infrastructure/realtime/broadcast.service';
import { notifyNewMessage } from '../../infrastructure/notifications/notification-helper';
import { isAutoReplyEnabled } from '../ai/ai-config.service';
import { processAndSendAiReply } from '../ai/ai-reply.service';
import { sendWelcomeMessage } from '../ai/welcome-message.service';
import { recordInboundMessage } from './whatsapp-pipeline-state';
import { whatsappRepository } from './whatsapp.repository';
import type { WhatsAppWebhookMessage } from '../../infrastructure/whatsapp/whatsapp.types';

const SIMPLE_GREETINGS =
  /^(hi|hello|hey|yo|salaam|asc|asalamu|waad salaaman|waan salaaman|good morning|good afternoon|good evening|subax wanaagsan)[\s!.?]*$/i;

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

function isSimpleGreeting(text: string): boolean {
  return SIMPLE_GREETINGS.test(text.trim());
}

/** Returns true when AI should respond (hybrid + AI modes). */
function shouldAiRespond(conversation: { isAiEnabled: boolean }): boolean {
  return conversation.isAiEnabled;
}

/**
 * Full inbound WhatsApp pipeline: save → welcome → KB-backed Gemini reply → WhatsApp send.
 */
export async function handleIncomingMessage(params: HandleIncomingMessageParams): Promise<void> {
  const { businessId, whatsappAccountId, phoneNumberId, accessToken, msg, contactName, extracted } =
    params;
  const startedAt = Date.now();

  const customer = await whatsappRepository.findOrCreateCustomer(
    businessId,
    msg.from,
    contactName ?? msg.from
  );
  console.log('[WhatsApp] Customer found');

  const { conversation, isNew } = await whatsappRepository.findOrCreateConversation(
    businessId,
    customer.id,
    whatsappAccountId
  );
  console.log('[WhatsApp] Conversation found', isNew ? '(new)' : '(existing)');

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

  const inboundCount = await prisma.message.count({
    where: {
      conversation: { businessId, customerId: customer.id },
      direction: 'INBOUND',
    },
  });
  const isFirstCustomerMessage = inboundCount === 1;

  const autoReplyEnabled =
    config.aiReply.enabled && (await isAutoReplyEnabled(businessId));
  const aiText = extracted.content?.trim() ?? '';
  const canReplyWithAi = autoReplyEnabled && shouldAiRespond(conversation) && Boolean(aiText);

  let welcomeSent = false;
  if (isFirstCustomerMessage && canReplyWithAi) {
    welcomeSent = await sendWelcomeMessage({
      businessId,
      conversationId: conversation.id,
      phoneNumberId,
      customerPhone: msg.from,
      accessToken,
      firstMessageContent: aiText,
    });
    if (welcomeSent) {
      console.log('[AI] Welcome message sent');
    }
  }

  const skipAiForGreeting = welcomeSent && isSimpleGreeting(aiText);

  if (canReplyWithAi && !skipAiForGreeting) {
    console.log('[AI] Triggering automatic reply (Knowledge Base + Gemini)');
    await processAndSendAiReply({
      businessId,
      conversationId: conversation.id,
      inboundMessageId: message.id,
      customerMessage: aiText,
      phoneNumberId,
      customerPhone: msg.from,
      accessToken,
    });
  } else if (!canReplyWithAi) {
    logger.debug('Auto-reply skipped', {
      conversationId: conversation.id,
      autoReplyEnabled,
      isAiEnabled: conversation.isAiEnabled,
      hasText: Boolean(aiText),
    });
  }

  // Defer media download so AI reply is not blocked
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

  const elapsed = Date.now() - startedAt;
  console.log(`[WhatsApp] handleIncomingMessage completed in ${elapsed}ms`);
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
