import { prisma } from '../../infrastructure/database/prisma';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { resolveOutboundWhatsAppToken } from '../whatsapp/whatsapp-token.service';
import { broadcastConversationEvent } from '../../infrastructure/realtime/broadcast.service';
import {
  recordOutboundAttempt,
  recordOutboundSuccess,
  recordGraphApiResponse,
  recordGraphApiError,
} from '../whatsapp/whatsapp-pipeline-state';
import { whatsappRepository } from '../whatsapp/whatsapp.repository';
import { logger } from '../../core/logger';
import { buildDynamicBusinessWelcome } from '../../infrastructure/ai/business-welcome.service';
import { buildTenantWelcomeMenu } from '../../infrastructure/ai/tenant-welcome-menu.service';
import { getCachedBusinessProfile } from '../../infrastructure/ai/business-tenant-cache.service';
import { getMenuOptionContent } from '../../infrastructure/ai/somali-menu';

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

  const tokenCheck = await resolveOutboundWhatsAppToken({
    phoneNumberId,
    accessToken,
  });
  if (!tokenCheck.ok) {
    recordGraphApiError(businessId, tokenCheck.error);
    logger.warn('Automated WhatsApp send blocked — invalid access token', { conversationId, phoneNumberId });

    await prisma.message.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        content,
        type: 'TEXT',
        isAiGenerated: true,
        status: 'FAILED',
        metadata: { ...metadata, graphApiError: tokenCheck.error } as object,
      },
    });

    void broadcastConversationEvent(businessId, { conversationId, type: 'message' }).catch(() => {});
    return false;
  }

  const sendResult = await whatsappService.sendOutbound({
    phoneNumberId,
    to: customerPhone,
    accessToken: tokenCheck.token,
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

/** Send Business Profile welcome (tenant identity — not Knowledge Base). */
export async function sendProfileWelcome(
  params: SendMenuParams & { preferEnglish?: boolean }
): Promise<boolean> {
  const profile = await getCachedBusinessProfile(params.businessId);
  const preferEnglish = params.preferEnglish === true;
  const content = await buildDynamicBusinessWelcome(
    params.businessId,
    preferEnglish
  );
  console.log('[AI] Sending Business Profile welcome', {
    businessId: params.businessId,
    language: preferEnglish ? 'en' : 'so',
    businessName: profile.business.name,
  });
  return sendAutomatedReply({
    ...params,
    content,
    metadata: { type: 'business_profile_welcome', language: preferEnglish ? 'en' : 'so' },
  });
}

/** Send Somali welcome + company profile + services menu for tenant businesses. */
export async function sendTenantWelcomeMenu(params: SendMenuParams): Promise<boolean> {
  const content = await buildTenantWelcomeMenu(params.businessId);
  console.log('[AI] Sending tenant welcome menu', { businessId: params.businessId });
  return sendAutomatedReply({
    ...params,
    content,
    metadata: { type: 'tenant_welcome_menu', language: 'so' },
  });
}

/** Send the business-scoped greeting/menu (SmartReception platform menu only). */
export async function sendServiceMenu(params: SendMenuParams): Promise<boolean> {
  const content = await buildDynamicBusinessWelcome(params.businessId);
  console.log('[AI] Sending platform/service menu', { businessId: params.businessId });
  return sendAutomatedReply({
    ...params,
    content,
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
