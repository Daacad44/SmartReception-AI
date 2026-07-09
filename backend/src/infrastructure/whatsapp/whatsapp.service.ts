import { config } from '../../config';
import { logger } from '../../core/logger';
import { prisma } from '../database/prisma';
import { resolveStoredToken } from '../crypto/token-crypto';
import type { SendOutboundParams, SendOutboundResult } from './whatsapp.types';
import type { WhatsAppWebhookMessage } from './whatsapp.types';
import { parseWebhookBody } from './whatsapp-webhook.parser';
import { normalizeWhatsAppTemplateLanguage } from './whatsapp-template-language.util';

export type { WhatsAppWebhookMessage, SendOutboundParams, SendOutboundResult } from './whatsapp.types';
export { parseWebhookBody, extractMessageContent, resolveContactName } from './whatsapp-webhook.parser';

const MAX_RETRIES = 3;
const WHATSAPP_AUTH_ERROR_CODES = new Set([10, 190, 102, 401]);

export function isWhatsAppAuthGraphError(error?: {
  code?: number | string;
  message?: string;
}): boolean {
  if (!error) return false;
  const code = Number(error.code);
  if (WHATSAPP_AUTH_ERROR_CODES.has(code)) return true;
  const message = (error.message ?? '').toLowerCase();
  return (
    message.includes('authentication error') ||
    message.includes('error validating access token') ||
    message.includes('invalid oauth') ||
    message.includes('session has expired')
  );
}

async function markWhatsAppTokenInvalid(phoneNumberId: string, error: Record<string, unknown>) {
  try {
    await prisma.whatsAppAccount.updateMany({
      where: { phoneNumberId, isActive: true },
      data: {
        lastGraphApiError: error as object,
        lastSyncAt: new Date(),
      },
    });
  } catch (markError) {
    logger.warn('Failed to mark WhatsApp token invalid', { phoneNumberId, markError });
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 && attempt < retries - 1) {
        const retryAfter = parseInt(response.headers.get('retry-after') ?? '2', 10);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

export class WhatsAppService {
  private getToken(accessToken?: string): string | null {
    const resolved = resolveStoredToken(accessToken) ?? accessToken?.trim();
    if (resolved) return resolved;
    return config.whatsapp.accessToken?.trim() || null;
  }

  async sendOutbound(params: SendOutboundParams): Promise<SendOutboundResult> {
    const token = this.getToken(params.accessToken);
    const to = params.to.replace(/\D/g, '');

    console.log('[WhatsApp] Phone Number ID:', params.phoneNumberId);
    console.log('[WhatsApp] Access Token configured:', Boolean(token));
    console.log('[WhatsApp] Recipient:', to);
    console.log('[WhatsApp] Message body:', params.content?.slice(0, 500) ?? '');

    if (!token) {
      logger.warn('WhatsApp access token not configured');
      return {
        success: false,
        whatsappMsgId: null,
        error: { code: 'NO_TOKEN', message: 'Access token not configured', recipient: to },
      };
    }
    let body: Record<string, unknown>;

    switch (params.type) {
      case 'IMAGE':
        body = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'image',
          image: {
            link: params.mediaUrl,
            ...(params.content ? { caption: params.content } : {}),
          },
        };
        break;
      case 'VIDEO':
        body = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'video',
          video: {
            link: params.mediaUrl,
            ...(params.content ? { caption: params.content } : {}),
          },
        };
        break;
      case 'AUDIO':
        body = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'audio',
          audio: { link: params.mediaUrl },
        };
        break;
      case 'DOCUMENT':
        body = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'document',
          document: {
            link: params.mediaUrl,
            filename: params.mediaFilename ?? 'document',
            ...(params.content ? { caption: params.content } : {}),
          },
        };
        break;
      case 'TEMPLATE':
        body = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'template',
          template: {
            name: params.templateName,
            language: { code: normalizeWhatsAppTemplateLanguage(params.templateLanguage) },
            ...(params.templateComponents?.length
              ? { components: params.templateComponents }
              : {}),
          },
        };
        break;
      case 'INTERACTIVE':
        if (params.interactiveListSections?.length) {
          body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'interactive',
            interactive: {
              type: 'list',
              body: { text: params.interactiveBody ?? params.content },
              action: {
                button: 'Options',
                sections: params.interactiveListSections,
              },
            },
          };
        } else {
          body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'interactive',
            interactive: {
              type: 'button',
              body: { text: params.interactiveBody ?? params.content },
              action: {
                buttons: (params.interactiveButtons ?? []).slice(0, 3).map((b) => ({
                  type: 'reply',
                  reply: { id: b.id, title: b.title.slice(0, 20) },
                })),
              },
            },
          };
        }
        break;
      default:
        body = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { body: params.content },
        };
    }

    const url = `${config.whatsapp.apiUrl}/${params.phoneNumberId}/messages`;
    console.log('[WhatsApp] Sending message');
    console.log('[WhatsApp] Graph API request:', JSON.stringify({ url, to, type: params.type }));

    try {
      const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      console.log('[WhatsApp] Graph API response:', responseText);

      if (!response.ok) {
        let errorCode: number | string = response.status;
        let errorMessage = responseText;
        try {
          const parsed = JSON.parse(responseText) as {
            error?: { code?: number; message?: string; error_subcode?: number };
          };
          if (parsed.error) {
            errorCode = parsed.error.code ?? parsed.error.error_subcode ?? response.status;
            errorMessage = parsed.error.message ?? responseText;
          }
        } catch {
          // keep raw response text
        }

        const graphError = { code: errorCode, message: errorMessage, recipient: to };
        console.error('[WhatsApp] Message failed:', graphError);
        logger.error('WhatsApp send failed:', graphError);
        if (isWhatsAppAuthGraphError(graphError)) {
          void markWhatsAppTokenInvalid(params.phoneNumberId, graphError);
        }
        return { success: false, whatsappMsgId: null, error: graphError };
      }

      const data = JSON.parse(responseText) as { messages?: { id: string }[] };
      const whatsappMsgId = data.messages?.[0]?.id ?? null;
      console.log('[WhatsApp] Message delivered:', whatsappMsgId ?? 'unknown id');
      return { success: Boolean(whatsappMsgId), whatsappMsgId, response: data };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const graphError = { code: 'NETWORK_ERROR', message, recipient: to };
      console.error('[WhatsApp] Message failed:', graphError);
      logger.error('WhatsApp send error:', graphError);
      return { success: false, whatsappMsgId: null, error: graphError };
    }
  }

  /** Alias for text-only outbound sends */
  async sendTextMessage(params: {
    phoneNumberId: string;
    to: string;
    message: string;
    accessToken?: string;
  }): Promise<SendOutboundResult> {
    return this.sendOutbound({
      phoneNumberId: params.phoneNumberId,
      to: params.to,
      accessToken: params.accessToken,
      type: 'TEXT',
      content: params.message,
    });
  }

  /** Alias for any outbound WhatsApp message */
  async sendWhatsAppMessage(params: SendOutboundParams): Promise<SendOutboundResult> {
    return this.sendOutbound(params);
  }

  async sendMessage(params: {
    phoneNumberId: string;
    to: string;
    message: string;
    accessToken?: string;
  }): Promise<string | null> {
    const result = await this.sendOutbound({
      phoneNumberId: params.phoneNumberId,
      to: params.to,
      accessToken: params.accessToken,
      type: 'TEXT',
      content: params.message,
    });
    return result.whatsappMsgId;
  }

  async sendTypingIndicator(phoneNumberId: string, to: string, accessToken?: string): Promise<void> {
    const token = this.getToken(accessToken);
    if (!token) return;

    try {
      await fetchWithRetry(`${config.whatsapp.apiUrl}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to.replace(/\D/g, ''),
          typing_indicator: { type: 'text' },
        }),
      });
    } catch (error) {
      logger.debug('Typing indicator failed:', error);
    }
  }

  async markAsRead(phoneNumberId: string, messageId: string, accessToken?: string): Promise<void> {
    const token = this.getToken(accessToken);
    if (!token) return;

    try {
      await fetchWithRetry(`${config.whatsapp.apiUrl}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      });
    } catch (error) {
      logger.debug('Mark as read failed:', error);
    }
  }

  async getPhoneNumberInfo(
    phoneNumberId: string,
    accessToken?: string
  ): Promise<{ displayPhoneNumber?: string; verifiedName?: string; qualityRating?: string } | null> {
    const token = this.getToken(accessToken);
    if (!token) return null;

    try {
      const response = await fetchWithRetry(
        `${config.whatsapp.apiUrl}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) return null;
      const data = (await response.json()) as {
        display_phone_number?: string;
        verified_name?: string;
        quality_rating?: string;
      };
      return {
        displayPhoneNumber: data.display_phone_number,
        verifiedName: data.verified_name,
        qualityRating: data.quality_rating,
      };
    } catch {
      return null;
    }
  }

  parseWebhookPayload(body: Record<string, unknown>): WhatsAppWebhookMessage[] {
    return parseWebhookBody(body).messages;
  }

  async identifyBusiness(phoneNumberId: string) {
    return prisma.whatsAppAccount.findUnique({
      where: { phoneNumberId },
      include: { business: true },
    });
  }
}

export const whatsappService = new WhatsAppService();
