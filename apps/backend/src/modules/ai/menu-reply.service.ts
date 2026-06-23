import { prisma } from '../../infrastructure/database/prisma';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { broadcastConversationEvent } from '../../infrastructure/realtime/broadcast.service';
import {
  recordOutboundAttempt,
  recordOutboundSuccess,
  recordGraphApiResponse,
  recordGraphApiError,
} from '../whatsapp/whatsapp-pipeline-state';
import { whatsappRepository } from '../whatsapp/whatsapp.repository';
import { logger } from '../../core/logger';
import {
  SMARTRECEPTION_SERVICE_MENU,
  getMenuOptionContent,
} from '../../infrastructure/ai/somali-menu';

export interface SendAutomatedReplyParams {
  businessId: string;
  conversationId: string;
  phoneNumberId: string;
  customerPhone: string;
  accessToken?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/** Send an AI-generated outbound WhatsApp message and persist to conversation. */
export async function sendAutomatedReply(params: SendAutomatedReplyParams): Promise<boolean> {
  const {
    businessId,
    conversationId,
    phoneNumberId,
    customerPhone,
    accessToken,
    content,
    metadata = {},
  } = params;

  recordOutboundAttempt(businessId, content);

  const sendResult = await whatsappService.sendOutbound({
    phoneNumberId,
    to: customerPhone,
    accessToken,
    type: 'TEXT',
    content,
  });

  if (sendResult.success && sendResult.whatsappMsgId) {
    recordOutboundSuccess(businessId, content);
    recordGraphApiResponse(businessId, sendResult.response);
    console.log('[WhatsApp] Automated message sent', { type: metadata.type });
  } else {
    recordGraphApiError(businessId, sendResult.error);
    logger.warn('Automated WhatsApp send failed', { conversationId, error: sendResult.error });
  }

  const outboundMessage = await prisma.message.create({
    data: {
      conversationId,
      direction: 'OUTBOUND',
      content,
      type: 'TEXT',
      isAiGenerated: true,
      status: sendResult.success ? 'SENT' : 'FAILED',
      whatsappMsgId: sendResult.whatsappMsgId,
      metadata: {
        ...metadata,
        ...(sendResult.error ? { graphApiError: sendResult.error } : {}),
      } as object,
    },
  });

  void prisma.conversation
    .update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    })
    .catch((error) => logger.warn('Failed to update conversation lastMessageAt', { error }));

  void broadcastConversationEvent(businessId, { conversationId, type: 'message' }).catch(
    (error) => logger.warn('Failed to broadcast automated reply', { error })
  );

  void whatsappRepository
    .recordGraphApiResult(phoneNumberId, {
      response: sendResult.response,
      error: sendResult.error,
    })
    .catch(() => {});

  return sendResult.success;
}

export interface SendMenuParams {
  businessId: string;
  conversationId: string;
  phoneNumberId: string;
  customerPhone: string;
  accessToken?: string;
}

/** Send the Somali SmartReception service menu to any customer. */
export async function sendServiceMenu(params: SendMenuParams): Promise<boolean> {
  console.log('[AI] Sending SmartReception service menu');
  return sendAutomatedReply({
    ...params,
    content: SMARTRECEPTION_SERVICE_MENU,
    metadata: { type: 'service_menu', language: 'so' },
  });
}

export interface SendMenuOptionParams extends SendMenuParams {
  option: number;
}

/** Send predefined Somali content for menu option 1-9. */
export async function sendMenuOptionReply(params: SendMenuOptionParams): Promise<boolean> {
  const content = getMenuOptionContent(params.option);
  if (!content) {
    logger.warn('Invalid menu option', { option: params.option });
    return false;
  }

  console.log('[AI] Menu option selected', { option: params.option });
  return sendAutomatedReply({
    businessId: params.businessId,
    conversationId: params.conversationId,
    phoneNumberId: params.phoneNumberId,
    customerPhone: params.customerPhone,
    accessToken: params.accessToken,
    content,
    metadata: { type: 'menu_option', option: params.option, language: 'so' },
  });
}
