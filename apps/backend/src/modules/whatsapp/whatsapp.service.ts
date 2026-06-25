import { whatsappRepository } from './whatsapp.repository';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { aiQueue } from '../../infrastructure/queue/queues';
import { config } from '../../config';
import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../core/logger';
import { NotFoundError } from '../../core/errors';
import {
  extractWebhookMetadata,
  whatsappTenantResolver,
} from './whatsapp-tenant-resolver.service';
import type { WebhookProcessResult } from './whatsapp-tenant.types';

export class WhatsAppModuleService {
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      return challenge;
    }
    return null;
  }

  /**
   * Process an incoming Meta webhook using phone_number_id tenant routing.
   * Never falls back to a default assistant or global credentials.
   */
  async processWebhook(body: Record<string, unknown>): Promise<WebhookProcessResult> {
    const entry = (body.entry as Record<string, unknown>[])?.[0];
    const changes = (entry?.changes as Record<string, unknown>[])?.[0];
    const value = (changes?.value as Record<string, unknown>) ?? {};

    const metadata = extractWebhookMetadata(value);
    const phoneNumberId = metadata.phone_number_id?.trim();

    if (!phoneNumberId) {
      logger.debug('Webhook received without phone_number_id');
      return { status: 'ignored', reason: 'missing_phone_number_id' };
    }

    const messages = whatsappService.parseWebhookPayload(body);
    if (messages.length === 0) {
      return { status: 'ignored', reason: 'no_messages' };
    }

    let messagesHandled = 0;

    for (const msg of messages) {
      if (msg.type !== 'text' || !msg.text?.body) {
        continue;
      }

      let tenant;
      try {
        tenant = await whatsappTenantResolver.resolveInbound(metadata, msg.from);
      } catch (error) {
        if (error instanceof NotFoundError) {
          logger.warn('WhatsApp tenant not found', { phoneNumberId, error: error.message });
          return { status: 'not_found', phoneNumberId };
        }
        throw error;
      }

      const customer = await whatsappRepository.findOrCreateCustomer(
        tenant.businessId,
        msg.from,
        msg.from
      );

      const conversation = await whatsappRepository.findOrCreateConversation(
        tenant.businessId,
        customer.id,
        tenant.account.id
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
        tenant.phoneNumberId,
        msg.id,
        tenant.accessToken
      );

      if (conversation.isAiEnabled && tenant.aiConfiguration.enableAutoReply) {
        await aiQueue.add('process-ai', {
          businessId: tenant.businessId,
          conversationId: conversation.id,
          messageId: message.id,
          customerMessage: msg.text.body,
          phoneNumberId: tenant.phoneNumberId,
        });
      }

      messagesHandled += 1;
      logger.info('WhatsApp inbound routed to tenant', {
        businessId: tenant.businessId,
        businessName: tenant.business.name,
        phoneNumberId: tenant.phoneNumberId,
        customerId: customer.id,
      });
    }

    return { status: 'processed', messagesHandled };
  }
}

export const whatsappModuleService = new WhatsAppModuleService();
