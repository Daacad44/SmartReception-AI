import { prisma } from '../../infrastructure/database/prisma';
import { Prisma } from '@prisma/client';
import { findCustomerByPhoneDigits, phoneDigits } from '../../core/utils/customer-phone';

export class WhatsAppRepository {
  async findAccountByPhoneNumberId(phoneNumberId: string) {
    const account = await prisma.whatsAppAccount.findUnique({
      where: { phoneNumberId },
      include: { business: true },
    });
    if (!account?.isActive) return null;
    return account;
  }

  async findAccountByBusiness(businessId: string) {
    return prisma.whatsAppAccount.findFirst({
      where: { businessId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async tryRecordWebhookEvent(
    eventId: string,
    eventType: string,
    businessId?: string
  ): Promise<boolean> {
    try {
      await prisma.whatsAppWebhookEvent.create({
        data: { eventId, eventType, businessId },
      });
      return true;
    } catch {
      return false;
    }
  }

  async findOrCreateCustomer(businessId: string, phone: string, name?: string) {
    const digits = phoneDigits(phone);
    if (!digits) {
      throw new Error('Invalid phone number');
    }

    const existing = await findCustomerByPhoneDigits(businessId, phone);

    if (existing) {
      if (name && name !== existing.name && name !== digits) {
        return prisma.customer.update({
          where: { id: existing.id },
          data: { name, whatsappId: phone },
        });
      }
      return existing;
    }

    const customer = await prisma.customer.create({
      data: {
        businessId,
        phone: digits,
        name: name || digits,
        whatsappId: phone,
        source: 'whatsapp',
      },
    });
    console.log('[WhatsApp] Customer created');
    return customer;
  }

  async findOrCreateConversation(
    businessId: string,
    customerId: string,
    whatsappAccountId: string
  ): Promise<{ conversation: Awaited<ReturnType<typeof prisma.conversation.create>>; isNew: boolean }> {
    const existing = await prisma.conversation.findFirst({
      where: {
        businessId,
        customerId,
        whatsappAccountId,
        status: { in: ['OPEN', 'PENDING'] },
      },
    });

    if (existing) {
      return { conversation: existing, isNew: false };
    }

    const staleConversation = await prisma.conversation.findFirst({
      where: {
        businessId,
        customerId,
        status: { in: ['OPEN', 'PENDING'] },
      },
    });

    if (staleConversation) {
      const updated = await prisma.conversation.update({
        where: { id: staleConversation.id },
        data: { whatsappAccountId },
      });
      return { conversation: updated, isNew: false };
    }

    const conversation = await prisma.conversation.create({
      data: {
        businessId,
        customerId,
        whatsappAccountId,
        status: 'OPEN',
        isAiEnabled: true,
      },
    });
    console.log('[WhatsApp] Conversation created');
    return { conversation, isNew: true };
  }

  async createInboundMessage(data: {
    conversationId: string;
    customerId: string;
    content: string;
    whatsappMsgId: string;
    type?: string;
    mediaUrl?: string;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: data.conversationId,
          direction: 'INBOUND',
          content: data.content,
          type: (data.type as 'TEXT') || 'TEXT',
          mediaUrl: data.mediaUrl,
          whatsappMsgId: data.whatsappMsgId,
          status: 'DELIVERED',
          metadata: data.metadata as object | undefined,
        },
      });

      await tx.conversation.update({
        where: { id: data.conversationId },
        data: {
          lastMessageAt: new Date(),
          unreadCount: { increment: 1 },
        },
      });

      await tx.customer.update({
        where: { id: data.customerId },
        data: { lastContactAt: new Date() },
      });

      console.log('[WhatsApp] Message stored');
      return message;
    });
  }

  async updateMessageStatus(
    whatsappMsgId: string,
    status: string,
    errors?: Array<{ code?: number; title?: string; message?: string }>
  ) {
    const statusMap: Record<string, 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'> = {
      sent: 'SENT',
      delivered: 'DELIVERED',
      read: 'READ',
      failed: 'FAILED',
    };
    const mapped = statusMap[status.toLowerCase()];
    if (!mapped) return null;

    const metadataUpdate =
      errors?.length ?
        { deliveryErrors: errors, lastStatusUpdate: status, updatedAt: new Date().toISOString() }
      : undefined;

    const existing = await prisma.message.findFirst({
      where: { whatsappMsgId },
      select: { metadata: true },
    });

    const mergedMetadata =
      metadataUpdate && existing?.metadata
        ? { ...(existing.metadata as object), ...metadataUpdate }
        : metadataUpdate;

    return prisma.message.updateMany({
      where: { whatsappMsgId },
      data: {
        status: mapped,
        ...(mergedMetadata ? { metadata: mergedMetadata as object } : {}),
      },
    });
  }

  async recordGraphApiResult(
    phoneNumberId: string,
    result: { response?: unknown; error?: unknown }
  ): Promise<void> {
    await prisma.whatsAppAccount.update({
      where: { phoneNumberId },
      data: {
        lastOutgoingAt: new Date(),
        lastSyncAt: new Date(),
        ...(result.response !== undefined
          ? {
              lastGraphApiResponse: result.response as Prisma.InputJsonValue,
              lastGraphApiError: Prisma.DbNull,
            }
          : {}),
        ...(result.error !== undefined
          ? { lastGraphApiError: result.error as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  async validateAccessToken(phoneNumberId: string, accessToken?: string): Promise<boolean> {
    const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN;
    if (!token) return false;

    try {
      const apiVersion = process.env.WHATSAPP_API_VERSION || 'v23.0';
      const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=display_phone_number`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async markWebhookVerified(phoneNumberId: string) {
    console.log('[WhatsApp] Webhook status set to VERIFIED');
    return prisma.whatsAppAccount.update({
      where: { phoneNumberId },
      data: {
        webhookVerified: true,
        webhookStatus: 'verified',
        lastSyncAt: new Date(),
      },
    });
  }

  async recordWebhookReceipt(phoneNumberId: string) {
    return prisma.whatsAppAccount.update({
      where: { phoneNumberId },
      data: {
        lastWebhookReceivedAt: new Date(),
        lastSyncAt: new Date(),
      },
    });
  }

  async getLastWebhookReceived(businessId: string): Promise<Date | null> {
    const account = await this.findAccountByBusiness(businessId);
    if (account?.lastWebhookReceivedAt) {
      return account.lastWebhookReceivedAt;
    }

    const event = await prisma.whatsAppWebhookEvent.findFirst({
      where: { businessId },
      orderBy: { receivedAt: 'desc' },
      select: { receivedAt: true },
    });
    return event?.receivedAt ?? null;
  }

  /** Strict tenant lookup — never falls back to env or arbitrary active accounts. */
  async resolveAccountForWebhook(phoneNumberId?: string) {
    if (!phoneNumberId?.trim()) {
      return null;
    }
    return this.findAccountByPhoneNumberId(phoneNumberId.trim());
  }

  async markAllActiveWebhooksVerified() {
    console.log('[WhatsApp] Webhook status set to VERIFIED');
    return prisma.whatsAppAccount.updateMany({
      where: { isActive: true },
      data: {
        webhookVerified: true,
        webhookStatus: 'verified',
        lastSyncAt: new Date(),
      },
    });
  }

  async hasWebhookActivity(businessId: string): Promise<boolean> {
    const event = await prisma.whatsAppWebhookEvent.findFirst({
      where: { businessId },
      select: { id: true },
    });
    return Boolean(event);
  }

  async syncAccountHealth(
    phoneNumberId: string,
    data: {
      phoneNumber?: string;
      phoneNumberStatus?: string;
      displayName?: string;
      wabaId?: string;
      webhookStatus?: string;
      webhookVerified?: boolean;
      lastWebhookReceivedAt?: Date;
    }
  ) {
    return prisma.whatsAppAccount.update({
      where: { phoneNumberId },
      data: {
        ...data,
        lastSyncAt: new Date(),
      },
    });
  }

  async updateAccountSync(phoneNumberId: string, data: {
    phoneNumber?: string;
    phoneNumberStatus?: string;
    displayName?: string;
    webhookStatus?: string;
  }) {
    return prisma.whatsAppAccount.update({
      where: { phoneNumberId },
      data: { ...data, lastSyncAt: new Date() },
    });
  }
}

export const whatsappRepository = new WhatsAppRepository();
