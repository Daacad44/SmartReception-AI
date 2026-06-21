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
      return existing;
    }

    return prisma.customer.create({
      data: {
        businessId,
        phone: normalizedPhone,
        name: name || normalizedPhone,
        whatsappId: phone,
        source: 'whatsapp',
      },
    });
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

    return prisma.conversation.create({
      data: {
        businessId,
        customerId,
        whatsappAccountId,
        status: 'OPEN',
        isAiEnabled: true,
      },
    });
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
    console.log('[WhatsApp] Webhook verified');
    return prisma.whatsAppAccount.update({
      where: { phoneNumberId },
      data: { webhookVerified: true, webhookStatus: 'verified', lastSyncAt: new Date() },
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
