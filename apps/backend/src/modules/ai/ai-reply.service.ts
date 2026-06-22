import { aiService } from '../../infrastructure/ai/openai.service';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../core/logger';
import {
  recordOutboundAttempt,
  recordOutboundSuccess,
  recordGraphApiResponse,
  recordGraphApiError,
} from '../whatsapp/whatsapp-pipeline-state';
import { whatsappRepository } from '../whatsapp/whatsapp.repository';
import { broadcastConversationEvent } from '../../infrastructure/realtime/broadcast.service';

export interface ProcessAiReplyParams {
  businessId: string;
  conversationId: string;
  inboundMessageId: string;
  customerMessage: string;
  phoneNumberId: string;
  customerPhone: string;
  accessToken?: string;
}

export async function processAndSendAiReply(params: ProcessAiReplyParams): Promise<void> {
  const {
    businessId,
    conversationId,
    inboundMessageId,
    customerMessage,
    phoneNumberId,
    customerPhone,
    accessToken,
  } = params;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, businessId },
    include: { customer: true, whatsappAccount: true },
  });

  if (!conversation || !conversation.isAiEnabled) {
    logger.debug(`Skipping AI reply for conversation ${conversationId}`);
    return;
  }

  console.log('[AI] Processing started');

  whatsappService
    .sendTypingIndicator(phoneNumberId, customerPhone, accessToken)
    .catch((error) => logger.debug('Typing indicator failed:', error));

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { isTyping: true },
  });

  const aiResponse = await aiService.generateResponse(businessId, conversationId, customerMessage);
  console.log('[AI] Response generated');

  const outboundMessage = await prisma.message.create({
    data: {
      conversationId,
      direction: 'OUTBOUND',
      content: aiResponse.content,
      type: 'TEXT',
      isAiGenerated: true,
      status: 'PENDING',
    },
  });

  await broadcastConversationEvent(businessId, { conversationId, type: 'message' });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  recordOutboundAttempt(businessId, aiResponse.content);
  console.log('[WhatsApp] Sending reply');

  const sendResult = await whatsappService.sendOutbound({
    phoneNumberId,
    to: customerPhone,
    accessToken,
    type: 'TEXT',
    content: aiResponse.content,
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { isTyping: false },
  });

  if (sendResult.success && sendResult.whatsappMsgId) {
    recordOutboundSuccess(businessId, aiResponse.content);
    recordGraphApiResponse(businessId, sendResult.response);
    console.log('[WhatsApp] Reply sent successfully');
  } else {
    recordGraphApiError(businessId, sendResult.error);
    console.error('[WhatsApp] Message failed:', sendResult.error);
  }

  await whatsappRepository.recordGraphApiResult(phoneNumberId, {
    response: sendResult.response,
    error: sendResult.error,
  }).catch((error) => logger.warn('Failed to record Graph API result', { error }));

  await prisma.message.update({
    where: { id: outboundMessage.id },
    data: {
      status: sendResult.success ? 'SENT' : 'FAILED',
      whatsappMsgId: sendResult.whatsappMsgId,
      metadata: sendResult.error
        ? { graphApiError: sendResult.error as object }
        : sendResult.response
          ? { graphApiResponse: sendResult.response as object }
          : undefined,
    },
  });

  await broadcastConversationEvent(businessId, { conversationId, type: 'message' });

  if (aiResponse.actions.some((a) => a.type === 'escalate')) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { isAiEnabled: false, status: 'PENDING' },
    });
  }

  const bookAction = aiResponse.actions.find((a) => a.type === 'book_appointment');
  if (bookAction?.data) {
    const data = bookAction.data as { title?: string; startTime?: string; endTime?: string };
    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
        await prisma.appointment.create({
          data: {
            businessId,
            customerId: conversation.customerId,
            title: data.title || 'AI Booked Appointment',
            startTime: start,
            endTime: end,
            status: 'SCHEDULED',
          },
        });
        logger.info(`AI booked appointment for conversation ${conversationId}`);
      }
    }
  }

  const qualifyAction = aiResponse.actions.find((a) => a.type === 'qualify_lead');
  if (qualifyAction?.data) {
    const score = Number(qualifyAction.data.score);
    if (!isNaN(score) && score >= 0 && score <= 100) {
      await prisma.customer.update({
        where: { id: conversation.customerId },
        data: { leadScore: Math.round(score) },
      });
      logger.info(`AI updated lead score for customer ${conversation.customerId}: ${score}`);
    }
  }

  logger.info(`AI response sent for conversation ${conversationId}, inbound message ${inboundMessageId}`);
}
