import { whatsappRepository } from './whatsapp.repository';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { aiQueue } from '../../infrastructure/queue/queues';
import { config } from '../../config';
import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../core/logger';

export class WhatsAppModuleService {
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      return challenge;
    }
    return null;
  }

  async processWebhook(body: Record<string, unknown>) {
    const entry = (body.entry as Record<string, unknown>[])?.[0];
    const changes = (entry?.changes as Record<string, unknown>[])?.[0];
    const value = changes?.value as Record<string, unknown>;
    const phoneNumberId = value?.metadata
      ? (value.metadata as Record<string, string>).phone_number_id
      : undefined;

    if (!phoneNumberId) {
      logger.debug('Webhook received without phone_number_id');
      return;
    }

    const account = await whatsappRepository.findAccountByPhoneNumberId(phoneNumberId);
    if (!account) {
      logger.warn(`No WhatsApp account found for phone_number_id: ${phoneNumberId}`);
      return;
    }

    const messages = whatsappService.parseWebhookPayload(body);

    for (const msg of messages) {
      if (msg.type !== 'text' || !msg.text?.body) {
        continue;
      }

      const customer = await whatsappRepository.findOrCreateCustomer(
        account.businessId,
        msg.from,
        msg.from
      );

      const conversation = await whatsappRepository.findOrCreateConversation(
        account.businessId,
        customer.id,
        account.id
      );

      const existingMessage = await prisma.message.findUnique({
        where: { whatsappMsgId: msg.id },
      });
      if (existingMessage) {
        continue;
      }

      const message = await whatsappRepository.createInboundMessage({
        conversationId: conversation.id,
        content: msg.text.body,
        whatsappMsgId: msg.id,
        type: 'TEXT',
      });

      await prisma.customer.update({
        where: { id: customer.id },
        data: { lastContactAt: new Date() },
      });

      await whatsappService.markAsRead(
        phoneNumberId,
        msg.id,
        account.accessToken || undefined
      );

      const aiConfig = await prisma.aIConfiguration.findUnique({
        where: { businessId: account.businessId },
      });

      if (conversation.isAiEnabled && aiConfig?.enableAutoReply) {
        await aiQueue.add('process-ai', {
          businessId: account.businessId,
          conversationId: conversation.id,
          messageId: message.id,
          customerMessage: msg.text.body,
        });
      }
    }
  }
}

export const whatsappModuleService = new WhatsAppModuleService();
