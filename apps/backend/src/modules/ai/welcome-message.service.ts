import { prisma } from '../../infrastructure/database/prisma';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import {
  detectMessageLanguage,
  getWelcomeForLanguage,
} from '../../infrastructure/ai/smartreception-knowledge';
import { logger } from '../../core/logger';
import { broadcastConversationEvent } from '../../infrastructure/realtime/broadcast.service';

export interface SendWelcomeParams {
  businessId: string;
  conversationId: string;
  phoneNumberId: string;
  customerPhone: string;
  accessToken?: string;
  firstMessageContent?: string;
}

export async function sendWelcomeMessage(params: SendWelcomeParams): Promise<boolean> {
  const {
    businessId,
    conversationId,
    phoneNumberId,
    customerPhone,
    accessToken,
    firstMessageContent,
  } = params;

  const aiConfig = await prisma.aIConfiguration.findUnique({
    where: { businessId },
    select: { greetingMessage: true, enableAutoReply: true },
  });

  if (!aiConfig?.enableAutoReply) {
    return false;
  }

  const lang = detectMessageLanguage(firstMessageContent || '');
  const content =
    aiConfig.greetingMessage?.trim() || getWelcomeForLanguage(lang);

  const outboundMessage = await prisma.message.create({
    data: {
      conversationId,
      direction: 'OUTBOUND',
      content,
      type: 'TEXT',
      isAiGenerated: true,
      status: 'PENDING',
      metadata: { type: 'welcome', language: lang },
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  await broadcastConversationEvent(businessId, {
    conversationId,
    type: 'message',
  });

  const sendResult = await whatsappService.sendOutbound({
    phoneNumberId,
    to: customerPhone,
    accessToken,
    type: 'TEXT',
    content,
  });

  await prisma.message.update({
    where: { id: outboundMessage.id },
    data: {
      status: sendResult.success ? 'SENT' : 'FAILED',
      whatsappMsgId: sendResult.whatsappMsgId,
    },
  });

  await broadcastConversationEvent(businessId, {
    conversationId,
    type: 'message',
  });

  if (!sendResult.success) {
    logger.warn('Welcome message send failed', { conversationId, error: sendResult.error });
  }

  return sendResult.success;
}
