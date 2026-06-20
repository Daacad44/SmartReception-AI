import { config } from '../../config';
import { logger } from '../../core/logger';
import { prisma } from '../database/prisma';
import type { SendOutboundParams } from './whatsapp.types';
import type { WhatsAppWebhookMessage } from './whatsapp.types';
import { parseWebhookBody } from './whatsapp-webhook.parser';

export type { WhatsAppWebhookMessage, SendOutboundParams } from './whatsapp.types';
export { parseWebhookBody, extractMessageContent } from './whatsapp-webhook.parser';

const MAX_RETRIES = 3;

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
    return accessToken || config.whatsapp.accessToken || null;
  }

  async sendOutbound(params: SendOutboundParams): Promise<string | null> {
    const token = this.getToken(params.accessToken);
    if (!token) {
      logger.warn('WhatsApp access token not configured');
      return null;
    }

    const to = params.to.replace(/\D/g, '');
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
            language: { code: params.templateLanguage ?? 'en' },
            components: params.templateComponents ?? [],
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

    try {
      const response = await fetchWithRetry(
        `${config.whatsapp.apiUrl}/${params.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        logger.error('WhatsApp send failed:', error);
        return null;
      }

      const data = (await response.json()) as { messages: { id: string }[] };
      return data.messages[0]?.id ?? null;
    } catch (error) {
      logger.error('WhatsApp send error:', error);
      return null;
    }
  }

  async sendMessage(params: {
    phoneNumberId: string;
    to: string;
    message: string;
    accessToken?: string;
  }): Promise<string | null> {
    return this.sendOutbound({
      phoneNumberId: params.phoneNumberId,
      to: params.to,
      accessToken: params.accessToken,
      type: 'TEXT',
      content: params.message,
    });
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
