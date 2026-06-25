import { prisma } from '../../infrastructure/database/prisma';

export class WhatsAppRepository {
  async findAccountByPhoneNumberId(phoneNumberId: string) {
    return prisma.whatsAppAccount.findFirst({
      where: { phoneNumberId, isActive: true },
      include: { business: true },
    });
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
        whatsappAccountId,
        status: { in: ['OPEN', 'PENDING'] },
      },
    });

    if (existing) {
      return existing;
    }

    const staleConversation = await prisma.conversation.findFirst({
      where: {
        businessId,
        customerId,
        status: { in: ['OPEN', 'PENDING'] },
      },
    });

    if (staleConversation) {
      return prisma.conversation.update({
        where: { id: staleConversation.id },
        data: { whatsappAccountId },
      });
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
    content: string;
    whatsappMsgId: string;
    type?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: data.conversationId,
          direction: 'INBOUND',
          content: data.content,
          type: (data.type as 'TEXT') || 'TEXT',
          whatsappMsgId: data.whatsappMsgId,
          status: 'DELIVERED',
        },
      });

      await tx.conversation.update({
        where: { id: data.conversationId },
        data: {
          lastMessageAt: new Date(),
          unreadCount: { increment: 1 },
        },
      });

      return message;
    });
  }

  async markWebhookVerified(phoneNumberId: string) {
    return prisma.whatsAppAccount.update({
      where: { phoneNumberId },
      data: { webhookVerified: true },
    });
  }
}

export const whatsappRepository = new WhatsAppRepository();
