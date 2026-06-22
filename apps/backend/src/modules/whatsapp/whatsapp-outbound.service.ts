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

export async function sendConversationMessage(
  params: SendConversationMessageParams
): Promise<boolean> {
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

  recordOutboundAttempt(businessId, content);
  console.log('[WhatsApp] Sending reply');

  const msgType = (type ?? 'TEXT') as OutboundMessageType;
  const sendResult = await whatsappService.sendOutbound({
    phoneNumberId,
    to: phoneNumber,
    accessToken,
    type: msgType,
    content,
    mediaUrl,
    mediaFilename,
  });

  if (sendResult.success && sendResult.whatsappMsgId) {
    recordOutboundSuccess(businessId, content);
    recordGraphApiResponse(businessId, sendResult.response);
    console.log('[WhatsApp] Reply sent successfully');
  } else {
    recordGraphApiError(businessId, sendResult.error);
  }

  await whatsappRepository.recordGraphApiResult(phoneNumberId, {
    response: sendResult.response,
    error: sendResult.error,
  }).catch((error) => logger.warn('Failed to record Graph API result', { error }));

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

  return sendResult.success;
}
