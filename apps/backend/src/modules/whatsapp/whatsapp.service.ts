import crypto from 'crypto';
import { whatsappRepository } from './whatsapp.repository';
import {
  whatsappService,
  parseWebhookBody,
  extractMessageContent,
} from '../../infrastructure/whatsapp/whatsapp.service';
import { whatsappMediaService } from '../../infrastructure/whatsapp/whatsapp-media.service';
import { getAiQueue } from '../../infrastructure/queue/queues';
import { config } from '../../config';
import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../core/logger';
import { ConnectWhatsAppInput } from '@smartreception/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors';
import { notifyNewMessage } from '../../infrastructure/notifications/notification-helper';

export class WhatsAppModuleService {
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    const appSecret =
      config.whatsapp.appSecret ||
      process.env.META_APP_SECRET ||
      process.env.WHATSAPP_APP_SECRET ||
      '';
    if (!appSecret) {
      logger.warn('WhatsApp app secret not configured — skipping signature verification');
      return true;
    }
    if (!signature) return false;

    const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const received = signature.replace('sha256=', '');
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
    } catch {
      return false;
    }
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = config.whatsapp.verifyToken;
    const normalizedMode = (mode ?? '').trim();
    const normalizedToken = (token ?? '').trim();
    const normalizedChallenge =
      challenge !== undefined && challenge !== null ? String(challenge).trim() : '';

    if (
      normalizedMode === 'subscribe' &&
      normalizedToken === verifyToken &&
      normalizedChallenge.length > 0
    ) {
      return normalizedChallenge;
    }
    return null;
  }

  async processWebhook(body: Record<string, unknown>) {
    const parsed = parseWebhookBody(body);
    const phoneNumberId = parsed.phoneNumberId;

    if (!phoneNumberId) {
      logger.debug('Webhook received without phone_number_id');
      return;
    }

    const account = await whatsappRepository.findAccountByPhoneNumberId(phoneNumberId);
    if (!account) {
      logger.warn(`No WhatsApp account found for phone_number_id: ${phoneNumberId}`);
      return;
    }

    await whatsappRepository.updateAccountSync(phoneNumberId, {
      webhookStatus: 'receiving',
    });

    const aiConfig = await prisma.aIConfiguration.findUnique({
      where: { businessId: account.businessId },
      select: { enableAutoReply: true },
    });

    for (const status of parsed.statuses) {
      const recorded = await whatsappRepository.tryRecordWebhookEvent(
        status.id,
        `status:${status.status}`,
        account.businessId
      );
      if (!recorded) continue;

      await whatsappRepository.updateMessageStatus(status.id, status.status);
      logger.info(`WhatsApp status ${status.status} for message ${status.id}`);
    }

    for (const msg of parsed.messages) {
      const recorded = await whatsappRepository.tryRecordWebhookEvent(
        msg.id,
        `message:${msg.type}`,
        account.businessId
      );
      if (!recorded) continue;

      const extracted = extractMessageContent(msg);
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

      let mediaUrl: string | undefined;
      let metadata = extracted.metadata ?? {};

      if (extracted.mediaId) {
        const token = account.accessToken || config.whatsapp.accessToken;
        if (token) {
          try {
            const { buffer, mimeType } = await whatsappMediaService.downloadFromMeta(
              extracted.mediaId,
              token
            );
            const stored = await whatsappMediaService.storeInboundMedia(
              buffer,
              mimeType,
              account.businessId,
              conversation.id,
              extracted.filename
            );
            mediaUrl = stored.url;
            metadata = {
              ...metadata,
              mimeType,
              fileSize: stored.fileSize,
              storageKey: stored.key,
              whatsappMediaId: extracted.mediaId,
            };
          } catch (error) {
            logger.error('Failed to download/store WhatsApp media:', error);
            metadata = { ...metadata, mediaDownloadFailed: true, whatsappMediaId: extracted.mediaId };
          }
        }
      }

      const message = await whatsappRepository.createInboundMessage({
        conversationId: conversation.id,
        customerId: customer.id,
        content: extracted.content,
        whatsappMsgId: msg.id,
        type: extracted.type,
        mediaUrl,
        metadata,
      });

      const accessToken = account.accessToken || config.whatsapp.accessToken || undefined;
      await whatsappService.markAsRead(phoneNumberId, msg.id, accessToken);

      await prisma.auditLog.create({
        data: {
          businessId: account.businessId,
          action: 'CREATE',
          entity: 'WhatsAppMessage',
          entityId: message.id,
          newData: { direction: 'INBOUND', type: extracted.type, from: msg.from },
        },
      });

      await notifyNewMessage(account.businessId, customer.name, conversation.id);

      const aiText =
        extracted.type === 'TEXT' || extracted.type === 'INTERACTIVE'
          ? extracted.content
          : extracted.content;

      if (conversation.isAiEnabled && aiConfig?.enableAutoReply && aiText) {
        await whatsappService.sendTypingIndicator(phoneNumberId, msg.from, accessToken);
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { isTyping: true },
        });

        const queue = getAiQueue();
        if (queue) {
          await queue.add('process-ai', {
            businessId: account.businessId,
            conversationId: conversation.id,
            messageId: message.id,
            customerMessage: aiText,
          });
        }
      }
    }

    await whatsappRepository.markWebhookVerified(phoneNumberId);
  }

  getWebhookUrl(): string {
    return config.whatsapp.webhookUrl;
  }

  getLegacyWebhookUrl(): string {
    return `${config.apiUrl}/api/v1/webhooks/whatsapp`;
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
        phoneNumberStatus: true,
        webhookStatus: true,
        lastSyncAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConnectionStatus(businessId: string) {
    const account = await whatsappRepository.findAccountByBusiness(businessId);
    const envConfigured = Boolean(
      config.whatsapp.accessToken && config.whatsapp.phoneNumberId
    );

    return {
      connected: Boolean(account?.isActive),
      account: account ?? null,
      envConfigured,
      webhookUrl: this.getWebhookUrl(),
      verifyTokenConfigured: Boolean(config.whatsapp.verifyToken),
      appSecretConfigured: Boolean(config.whatsapp.appSecret),
    };
  }

  async connectAccount(businessId: string, input: ConnectWhatsAppInput) {
    const existing = await prisma.whatsAppAccount.findUnique({
      where: { phoneNumberId: input.phoneNumberId },
    });

    if (existing && existing.businessId !== businessId) {
      throw new ConflictError('This phone number is already connected to another business');
    }

    const account = await prisma.whatsAppAccount.upsert({
      where: { phoneNumberId: input.phoneNumberId },
      create: {
        businessId,
        phoneNumberId: input.phoneNumberId,
        phoneNumber: input.phoneNumber,
        displayName: input.displayName,
        wabaId: input.wabaId ?? config.whatsapp.businessAccountId,
        accessToken: input.accessToken,
        isActive: true,
        phoneNumberStatus: 'connected',
        webhookStatus: 'pending',
      },
      update: {
        phoneNumber: input.phoneNumber,
        displayName: input.displayName,
        wabaId: input.wabaId ?? config.whatsapp.businessAccountId,
        accessToken: input.accessToken,
        isActive: true,
        phoneNumberStatus: 'connected',
        lastSyncAt: new Date(),
      },
      select: {
        id: true,
        phoneNumberId: true,
        phoneNumber: true,
        displayName: true,
        webhookVerified: true,
        phoneNumberStatus: true,
        webhookStatus: true,
        lastSyncAt: true,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        action: 'CREATE',
        entity: 'WhatsAppAccount',
        entityId: account.id,
        newData: { phoneNumberId: input.phoneNumberId },
      },
    });

    return account;
  }

  async connectFromEnv(businessId: string) {
    const phoneNumberId = config.whatsapp.phoneNumberId;
    const accessToken = config.whatsapp.accessToken;
    const wabaId = config.whatsapp.businessAccountId;

    if (!phoneNumberId || !accessToken) {
      throw new ValidationError(
        'WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN must be set in environment variables'
      );
    }

    const info = await whatsappService.getPhoneNumberInfo(phoneNumberId, accessToken);
    const displayPhone = info?.displayPhoneNumber ?? phoneNumberId;

    return this.connectAccount(businessId, {
      phoneNumberId,
      phoneNumber: displayPhone,
      displayName: info?.verifiedName,
      wabaId: wabaId || undefined,
      accessToken,
    });
  }

  async testConnection(businessId: string, accountId?: string) {
    const account = accountId
      ? await prisma.whatsAppAccount.findFirst({ where: { id: accountId, businessId } })
      : await whatsappRepository.findAccountByBusiness(businessId);

    if (!account) {
      throw new NotFoundError('No active WhatsApp account found');
    }

    const token = account.accessToken || config.whatsapp.accessToken;
    if (!token) {
      throw new ValidationError('WhatsApp access token is not configured');
    }

    const info = await whatsappService.getPhoneNumberInfo(account.phoneNumberId, token);
    if (!info) {
      throw new ValidationError('Failed to reach WhatsApp Cloud API — check credentials');
    }

    await whatsappRepository.updateAccountSync(account.phoneNumberId, {
      phoneNumberStatus: info.qualityRating ?? 'connected',
      displayName: info.verifiedName ?? account.displayName ?? undefined,
      webhookStatus: account.webhookVerified ? 'verified' : 'pending',
    });

    return {
      success: true,
      displayPhoneNumber: info.displayPhoneNumber,
      verifiedName: info.verifiedName,
      qualityRating: info.qualityRating,
      testedAt: new Date().toISOString(),
    };
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
      data: { isActive: false, phoneNumberStatus: 'disconnected' },
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        action: 'DELETE',
        entity: 'WhatsAppAccount',
        entityId: accountId,
      },
    });
  }
}

export const whatsappModuleService = new WhatsAppModuleService();
