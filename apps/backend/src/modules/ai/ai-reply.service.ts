import { aiService } from '../../infrastructure/ai/conversation-ai.service';
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
import { LEAD_THANK_YOU_SO } from '../../infrastructure/ai/smartreception-knowledge';
import type { LeadData } from '../../infrastructure/ai/ai.types';
import { logPipelineStep } from '../whatsapp/message-pipeline.logger';

export interface ProcessAiReplyParams {
  businessId: string;
  conversationId: string;
  inboundMessageId: string;
  customerMessage: string;
  phoneNumberId: string;
  customerPhone: string;
  accessToken?: string;
  preferEnglish?: boolean;
  pipelineKey?: string;
}

function parseLeadData(data: Record<string, unknown> | undefined): LeadData | null {
  if (!data) return null;
  return {
    fullName: typeof data.fullName === 'string' ? data.fullName : undefined,
    businessName: typeof data.businessName === 'string' ? data.businessName : undefined,
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    email: typeof data.email === 'string' ? data.email : undefined,
    service: typeof data.service === 'string' ? data.service : undefined,
    complete: data.complete === true,
  };
}

async function persistLeadData(
  businessId: string,
  customerId: string,
  lead: LeadData
): Promise<void> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
  });
  if (!customer) return;

  const notesParts: string[] = [];
  if (customer.notes) notesParts.push(customer.notes);
  if (lead.businessName) notesParts.push(`Business: ${lead.businessName}`);
  if (lead.service) notesParts.push(`Service: ${lead.service}`);

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      name: lead.fullName || customer.name,
      email: lead.email || customer.email,
      phone: lead.phone || customer.phone,
      notes: notesParts.length ? notesParts.join('\n') : customer.notes,
      ...(lead.complete ? { leadScore: Math.max(customer.leadScore, 80) } : {}),
      lastContactAt: new Date(),
    },
  });

  if (lead.complete) {
    const summary = [
      'Lead captured via WhatsApp AI',
      lead.fullName && `Name: ${lead.fullName}`,
      lead.businessName && `Business: ${lead.businessName}`,
      lead.phone && `Phone: ${lead.phone}`,
      lead.email && `Email: ${lead.email}`,
      lead.service && `Service: ${lead.service}`,
    ]
      .filter(Boolean)
      .join('\n');

    await prisma.customerNote.create({
      data: { customerId, content: summary },
    });
    logger.info('Lead saved from WhatsApp AI', { customerId });
  }
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

  console.log('[AI] Processing started (Gemini)');

  whatsappService
    .sendTypingIndicator(phoneNumberId, customerPhone, accessToken)
    .catch((error) => logger.debug('Typing indicator failed:', error));

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { isTyping: true },
  });

  const aiResponse = await aiService.generateResponse(
    businessId,
    conversationId,
    customerMessage,
    { preferEnglish: params.preferEnglish }
  );
  if (params.pipelineKey) {
    logPipelineStep(params.pipelineKey, 'ai_finished', { intent: aiResponse.intent });
  }
  console.log('[AI] Response generated (Gemini)', {
    intent: aiResponse.intent,
    preview: aiResponse.content.slice(0, 120),
  });

  const collectLeadAction = aiResponse.actions.find((a) => a.type === 'collect_lead');
  const leadData = parseLeadData(collectLeadAction?.data);
  if (leadData) {
    await persistLeadData(businessId, conversation.customerId, leadData);
  }

  let replyContent = aiResponse.content;
  if (leadData?.complete) {
    replyContent = `${replyContent}\n\n${LEAD_THANK_YOU_SO}`;
  }

  const outboundMessage = await prisma.message.create({
    data: {
      conversationId,
      direction: 'OUTBOUND',
      content: replyContent,
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

  recordOutboundAttempt(businessId, replyContent);
  console.log('[WhatsApp] Sending reply');

  const sendResult = await whatsappService.sendOutbound({
    phoneNumberId,
    to: customerPhone,
    accessToken,
    type: 'TEXT',
    content: replyContent,
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { isTyping: false },
  });

  if (sendResult.success && sendResult.whatsappMsgId) {
    recordOutboundSuccess(businessId, replyContent);
    recordGraphApiResponse(businessId, sendResult.response);
    console.log('[WhatsApp] Message sent', { whatsappMsgId: sendResult.whatsappMsgId });
  } else {
    recordGraphApiError(businessId, sendResult.error);
    console.error('[WhatsApp] Message failed:', sendResult.error);
    if (params.pipelineKey) {
      logPipelineStep(params.pipelineKey, 'reply_failed', { error: sendResult.error });
    }
  }

  await whatsappRepository
    .recordGraphApiResult(phoneNumberId, {
      response: sendResult.response,
      error: sendResult.error,
    })
    .catch((error) => logger.warn('Failed to record Graph API result', { error }));

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
