import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../core/logger';
import type { OutboundMessageType } from '../../infrastructure/whatsapp/whatsapp.types';
import {
  recordOutboundAttempt,
  recordOutboundSuccess,
} from './whatsapp-pipeline-state';

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
    console.log('[WhatsApp] Reply sent successfully');
  } else {
    logger.error('WhatsApp outbound send failed', {
      messageId,
      recipient: phoneNumber,
      error: sendResult.error,
    });
  }

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
