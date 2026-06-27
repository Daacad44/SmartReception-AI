import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../core/logger';
import type { OutboundMessageType } from '../../infrastructure/whatsapp/whatsapp.types';
import {
  recordOutboundAttempt,
  recordOutboundSuccess,
  recordGraphApiResponse,
  recordGraphApiError,
} from './whatsapp-pipeline-state';
import { whatsappRepository } from './whatsapp.repository';
import { phoneDigits } from '../../core/utils/customer-phone';

export interface SendConversationMessageParams {
  businessId: string;
  conversationId: string;
  messageId: string;
  phoneNumber: string;
  phoneNumberId: string;
  content: string;
  type?: string;
  mediaUrl?: string;
  mediaFilename?: string;
  accessToken?: string;
}

export interface SendConversationMessageResult {
  success: boolean;
  whatsappMsgId: string | null;
  error?: Record<string, unknown>;
}

export async function sendConversationMessage(
  params: SendConversationMessageParams
): Promise<SendConversationMessageResult> {
  const {
    businessId,
    messageId,
    phoneNumber,
    phoneNumberId,
    content,
    type,
    mediaUrl,
    mediaFilename,
    accessToken,
  } = params;

  const recipient = phoneDigits(phoneNumber);
  recordOutboundAttempt(businessId, content);

  logger.info('[Outbound] WhatsApp Graph API request starting', {
    businessId,
    messageId,
    phoneNumberId,
    recipient,
    type: type ?? 'TEXT',
    hasToken: Boolean(accessToken?.trim()),
  });

  const msgType = (type ?? 'TEXT') as OutboundMessageType;
  const sendResult = await whatsappService.sendOutbound({
    phoneNumberId,
    to: recipient,
    accessToken,
    type: msgType,
    content,
    mediaUrl,
    mediaFilename,
  });

  if (sendResult.success && sendResult.whatsappMsgId) {
    recordOutboundSuccess(businessId, content);
    recordGraphApiResponse(businessId, sendResult.response);
    logger.info('[Outbound] WhatsApp Graph API success', {
      businessId,
      messageId,
      whatsappMsgId: sendResult.whatsappMsgId,
      recipient,
    });
  } else {
    recordGraphApiError(businessId, sendResult.error);
    logger.error('[Outbound] WhatsApp Graph API failure', {
      businessId,
      messageId,
      recipient,
      error: sendResult.error,
    });
  }

  await whatsappRepository
    .recordGraphApiResult(phoneNumberId, {
      response: sendResult.response,
      error: sendResult.error,
    })
    .catch((error) => logger.warn('Failed to record Graph API result', { error }));

  await prisma.message.update({
    where: { id: messageId },
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

  return {
    success: sendResult.success,
    whatsappMsgId: sendResult.whatsappMsgId,
    error: sendResult.error as Record<string, unknown> | undefined,
  };
}
