import { prisma } from '../../infrastructure/database/prisma';
import { sendServiceMenu } from './menu-reply.service';
import { logger } from '../../core/logger';

export interface SendWelcomeParams {
  businessId: string;
  conversationId: string;
  phoneNumberId: string;
  customerPhone: string;
  accessToken?: string;
  firstMessageContent?: string;
}

/** @deprecated Use sendServiceMenu — sends Somali interactive menu */
export async function sendWelcomeMessage(params: SendWelcomeParams): Promise<boolean> {
  const aiConfig = await prisma.aIConfiguration.findUnique({
    where: { businessId: params.businessId },
    select: { enableAutoReply: true },
  });

  if (!aiConfig?.enableAutoReply) {
    return false;
  }

  const sent = await sendServiceMenu(params);
  if (!sent) {
    logger.warn('Service menu send failed', { conversationId: params.conversationId });
  }
  return sent;
}
