import crypto from 'crypto';
import { whatsappRepository } from './whatsapp.repository';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { getAiQueue } from '../../infrastructure/queue/queues';
import { config } from '../../config';
import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../core/logger';
import { ConnectWhatsAppInput } from '@smartreception/shared';
import { ConflictError, NotFoundError } from '../../core/errors';
import { notifyNewMessage } from '../../infrastructure/notifications/notification-helper';

export class WhatsAppModuleService {
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    const appSecret = config.whatsapp.appSecret;
    if (!appSecret) return true;
    if (!signature) return false;

    const expected = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    const received = signature.replace('sha256=', '');
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
    } catch {
      return false;
    }
  }

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

      await notifyNewMessage(account.businessId, customer.name, conversation.id);

      const aiConfig = await prisma.aIConfiguration.findUnique({
        where: { businessId: account.businessId },
      });

      if (conversation.isAiEnabled && aiConfig?.enableAutoReply) {
        const queue = getAiQueue();
        if (queue) {
          await queue.add('process-ai', {
            businessId: account.businessId,
            conversationId: conversation.id,
            messageId: message.id,
            customerMessage: msg.text.body,
          });
        }
      }
    }
  }

  async listAccounts(businessId: string) {
    return prisma.whatsAppAccount.findMany({
      where: { businessId },
      select: {
        id: true,
        phoneNumberId: true,
        phoneNumber: true,
        displayName: true,
        wabaId: true,
        webhookVerified: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  getWebhookUrl(): string {
    return `${config.apiUrl}/api/v1/whatsapp/webhook`;
  }

  async connectAccount(businessId: string, input: ConnectWhatsAppInput) {
    const existing = await prisma.whatsAppAccount.findUnique({
      where: { phoneNumberId: input.phoneNumberId },
    });

    if (existing && existing.businessId !== businessId) {
      throw new ConflictError('This phone number is already connected to another business');
    }

    return prisma.whatsAppAccount.upsert({
      where: { phoneNumberId: input.phoneNumberId },
      create: {
        businessId,
        phoneNumberId: input.phoneNumberId,
        phoneNumber: input.phoneNumber,
        displayName: input.displayName,
        wabaId: input.wabaId,
        accessToken: input.accessToken,
        isActive: true,
      },
      update: {
        phoneNumber: input.phoneNumber,
        displayName: input.displayName,
        wabaId: input.wabaId,
        accessToken: input.accessToken,
        isActive: true,
      },
      select: {
        id: true,
        phoneNumberId: true,
        phoneNumber: true,
        displayName: true,
        webhookVerified: true,
        isActive: true,
      },
    });
  }

  async disconnectAccount(businessId: string, accountId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: accountId, businessId },
    });
    if (!account) {
      throw new NotFoundError('WhatsApp account not found');
    }

    await prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: { isActive: false },
    });
  }
}

export const whatsappModuleService = new WhatsAppModuleService();
