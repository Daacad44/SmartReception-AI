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

export interface WhatsAppHealth {
  connection: 'connected' | 'disconnected';
  webhook: 'verified' | 'pending' | 'not_configured';
  phoneStatus: 'active' | 'unknown' | 'inactive';
  phoneNumber: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  lastSync: string | null;
  envConfigured: boolean;
}

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

  async recordWebhookReceived(body: Record<string, unknown>): Promise<void> {
    console.log('[WhatsApp] Meta webhook received');

    if (!config.whatsapp.verifyToken || !config.whatsapp.webhookUrl) {
      return;
    }

    const parsed = parseWebhookBody(body);
    const phoneNumberId = parsed.phoneNumberId ?? config.whatsapp.phoneNumberId;
    if (!phoneNumberId) {
      logger.debug('Webhook received without phone_number_id');
      return;
    }

    const account = await whatsappRepository.findAccountByPhoneNumberId(phoneNumberId);
    if (!account) {
      logger.warn(`No WhatsApp account found for phone_number_id: ${phoneNumberId}`);
      return;
    }

    await whatsappRepository.markWebhookVerified(phoneNumberId);

    const syncData: {
      webhookStatus: string;
      phoneNumberStatus?: string;
      displayName?: string;
    } = { webhookStatus: 'verified' };

    if (parsed.displayPhoneNumber) {
      syncData.phoneNumberStatus = 'active';
      console.log('[WhatsApp] Phone active');
      await whatsappRepository.syncAccountHealth(phoneNumberId, {
        ...syncData,
        phoneNumber: parsed.displayPhoneNumber,
      });
      return;
    }

    await whatsappRepository.syncAccountHealth(phoneNumberId, syncData);
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

    if (!account.webhookVerified) {
      await whatsappRepository.markWebhookVerified(phoneNumberId);
    }

    await whatsappRepository.updateAccountSync(phoneNumberId, {
      webhookStatus: 'verified',
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

  async getHealth(businessId: string): Promise<WhatsAppHealth> {
    const account = await whatsappRepository.findAccountByBusiness(businessId);
    const verifyTokenConfigured = Boolean(config.whatsapp.verifyToken);
    const webhookEndpointConfigured = Boolean(config.whatsapp.webhookUrl);
    const envConfigured = Boolean(
      config.whatsapp.accessToken && config.whatsapp.phoneNumberId
    );

    if (!account?.isActive) {
      return {
        connection: 'disconnected',
        webhook: verifyTokenConfigured && webhookEndpointConfigured ? 'pending' : 'not_configured',
        phoneStatus: 'unknown',
        phoneNumber: null,
        phoneNumberId: null,
        wabaId: null,
        lastSync: null,
        envConfigured,
      };
    }

    const token = account.accessToken || config.whatsapp.accessToken;
    let phoneNumber = account.phoneNumber;
    let phoneStatus: WhatsAppHealth['phoneStatus'] =
      account.phoneNumberStatus === 'active' ? 'active' : 'unknown';
    let wabaId = account.wabaId ?? config.whatsapp.businessAccountId ?? null;

    if (token) {
      const info = await whatsappService.getPhoneNumberInfo(account.phoneNumberId, token);
      if (info?.displayPhoneNumber) {
        phoneNumber = info.displayPhoneNumber;
        phoneStatus = 'active';
        console.log('[WhatsApp] Phone active');
        await whatsappRepository.syncAccountHealth(account.phoneNumberId, {
          phoneNumber: info.displayPhoneNumber,
          phoneNumberStatus: 'active',
          displayName: info.verifiedName ?? account.displayName ?? undefined,
          wabaId: wabaId ?? undefined,
        });
      } else if (info) {
        await whatsappRepository.syncAccountHealth(account.phoneNumberId, {
          displayName: info.verifiedName ?? account.displayName ?? undefined,
        });
      }
    }

    const hasWebhookActivity =
      account.webhookVerified || (await whatsappRepository.hasWebhookActivity(businessId));

    let webhook: WhatsAppHealth['webhook'];
    if (hasWebhookActivity && verifyTokenConfigured && webhookEndpointConfigured) {
      if (!account.webhookVerified) {
        await whatsappRepository.markWebhookVerified(account.phoneNumberId);
      }
      webhook = 'verified';
    } else if (verifyTokenConfigured && webhookEndpointConfigured) {
      webhook = 'pending';
    } else {
      webhook = 'not_configured';
    }

    const synced = await whatsappRepository.syncAccountHealth(account.phoneNumberId, {
      webhookStatus: webhook,
      webhookVerified: webhook === 'verified',
      phoneNumberStatus: phoneStatus,
      phoneNumber,
      wabaId: wabaId ?? undefined,
    });

    console.log('[WhatsApp] Health check successful');

    return {
      connection: 'connected',
      webhook,
      phoneStatus,
      phoneNumber: synced.phoneNumber,
      phoneNumberId: synced.phoneNumberId,
      wabaId: synced.wabaId ?? wabaId,
      lastSync: synced.lastSyncAt?.toISOString() ?? new Date().toISOString(),
      envConfigured,
    };
  }

  getWebhookUrl(): string {
    return config.whatsapp.webhookUrl;
  }

  getLegacyWebhookUrl(): string {
    return `${config.apiUrl}/webhook`;
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
        phoneNumberStatus: 'active',
        webhookStatus: 'pending',
      },
      update: {
        phoneNumber: input.phoneNumber,
        displayName: input.displayName,
        wabaId: input.wabaId ?? config.whatsapp.businessAccountId,
        accessToken: input.accessToken,
        isActive: true,
        phoneNumberStatus: 'active',
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
      phoneNumberStatus: info.displayPhoneNumber ? 'active' : account.phoneNumberStatus ?? 'unknown',
      displayName: info.verifiedName ?? account.displayName ?? undefined,
      webhookStatus: 'verified',
      phoneNumber: info.displayPhoneNumber ?? account.phoneNumber,
    });

    if (info.displayPhoneNumber) {
      console.log('[WhatsApp] Phone active');
    }

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
