import { prisma } from '../../infrastructure/database/prisma';

export class WhatsAppRepository {
  async findAccountByPhoneNumberId(phoneNumberId: string) {
    return prisma.whatsAppAccount.findUnique({
      where: { phoneNumberId },
    });
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
    const normalizedPhone = phone.replace(/\D/g, '');
    const existing = await prisma.customer.findUnique({
      where: { businessId_phone: { businessId, phone: normalizedPhone } },
    });

    if (existing) {
      if (name && name !== existing.name && name !== normalizedPhone) {
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
        phone: normalizedPhone,
        name: name || normalizedPhone,
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
  ) {
    const existing = await prisma.conversation.findFirst({
      where: {
        businessId,
        customerId,
        status: { in: ['OPEN', 'PENDING'] },
      },
    });

    if (existing) {
      return existing;
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
    return conversation;
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

  async updateMessageStatus(whatsappMsgId: string, status: string) {
    const statusMap: Record<string, 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'> = {
      sent: 'SENT',
      delivered: 'DELIVERED',
      read: 'READ',
      failed: 'FAILED',
    };
    const mapped = statusMap[status.toLowerCase()];
    if (!mapped) return null;

    return prisma.message.updateMany({
      where: { whatsappMsgId },
      data: { status: mapped },
    });
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

  async resolveAccountForWebhook(phoneNumberId?: string) {
    if (phoneNumberId) {
      const byId = await this.findAccountByPhoneNumberId(phoneNumberId);
      if (byId) return byId;
    }

    const envPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (envPhoneNumberId) {
      const byEnv = await this.findAccountByPhoneNumberId(envPhoneNumberId);
      if (byEnv) return byEnv;
    }

    return prisma.whatsAppAccount.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
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
