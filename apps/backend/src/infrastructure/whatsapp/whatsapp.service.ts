import { config } from '../../config';
import { logger } from '../../core/logger';

export interface SendMessageParams {
  phoneNumberId: string;
  to: string;
  message: string;
  accessToken: string;
}

export interface WhatsAppWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
}

export class WhatsAppCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WhatsAppCredentialsError';
  }
}

export class WhatsAppService {
  private requireAccessToken(accessToken: string | undefined | null, operation: string): string {
    const token = accessToken?.trim();
    if (!token) {
      throw new WhatsAppCredentialsError(
        `Missing WhatsApp access token for ${operation}. Configure per-business credentials.`
      );
    }
    return token;
  }

  async sendMessage(params: SendMessageParams): Promise<string | null> {
    const { phoneNumberId, to, message } = params;
    const token = this.requireAccessToken(params.accessToken, 'sendMessage');

    try {
      const response = await fetch(
        `${config.whatsapp.apiUrl}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: to.replace(/\D/g, ''),
            type: 'text',
            text: { body: message },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        logger.error('WhatsApp send failed:', { error, phoneNumberId });
        return null;
      }

      const data = (await response.json()) as { messages: { id: string }[] };
      return data.messages[0]?.id || null;
    } catch (error) {
      logger.error('WhatsApp send error:', { error, phoneNumberId });
      return null;
    }
  }

  async sendTypingIndicator(
    phoneNumberId: string,
    to: string,
    accessToken: string
  ): Promise<void> {
    const token = this.requireAccessToken(accessToken, 'sendTypingIndicator');

    try {
      await fetch(`${config.whatsapp.apiUrl}/${phoneNumberId}/messages`, {
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

  async markAsRead(
    phoneNumberId: string,
    messageId: string,
    accessToken: string
  ): Promise<void> {
    const token = this.requireAccessToken(accessToken, 'markAsRead');

    try {
      await fetch(`${config.whatsapp.apiUrl}/${phoneNumberId}/messages`, {
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

  parseWebhookPayload(body: Record<string, unknown>): WhatsAppWebhookMessage[] {
    const messages: WhatsAppWebhookMessage[] = [];

    const entry = (body.entry as Record<string, unknown>[])?.[0];
    const changes = (entry?.changes as Record<string, unknown>[])?.[0];
    const value = changes?.value as Record<string, unknown>;
    const incomingMessages = value?.messages as WhatsAppWebhookMessage[];

    if (incomingMessages) {
      messages.push(...incomingMessages);
    }

    return messages;
  }
}

export const whatsappService = new WhatsAppService();
