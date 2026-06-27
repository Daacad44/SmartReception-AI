import { prisma } from '../../infrastructure/database/prisma';
import type { Prisma } from '@prisma/client';
import { PaginationInput } from '@smartreception/shared';

export class ConversationsRepository {
  async findMany(
    businessId: string,
    params: PaginationInput & { status?: string; assignedToId?: string }
  ) {
    const { page, limit, search, sortBy, sortOrder, status, assignedToId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ConversationWhereInput = {
      businessId,
      ...(status && { status: status as Prisma.EnumConversationStatusFilter['equals'] }),
      ...(assignedToId && { assignedToId }),
      ...(search && {
        customer: {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        },
      }),
    };

    const orderBy: Prisma.ConversationOrderByWithRelationInput = sortBy
      ? { [sortBy]: sortOrder }
      : { lastMessageAt: sortOrder };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              content: true,
              createdAt: true,
              direction: true,
              status: true,
            },
          },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    return { conversations, total, page, limit };
  }

  async getSummary(businessId: string) {
    const [unreadAgg, aiHandlingCount] = await Promise.all([
      prisma.conversation.aggregate({
        where: { businessId },
        _sum: { unreadCount: true },
      }),
      prisma.conversation.count({
        where: {
          businessId,
          status: 'OPEN',
          isAiEnabled: true,
          assignedToId: null,
        },
      }),
    ]);

    return {
      unreadTotal: unreadAgg._sum.unreadCount ?? 0,
      aiHandlingCount,
    };
  }

  async exists(businessId: string, id: string) {
    return prisma.conversation.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
  }

  async findById(businessId: string, id: string) {
    return prisma.conversation.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        whatsappAccount: { select: { id: true, phoneNumber: true, displayName: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sentByUser: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async createMessage(data: {
    conversationId: string;
    direction: 'INBOUND' | 'OUTBOUND';
    content: string;
    type?: string;
    mediaUrl?: string;
    sentByUserId?: string;
    isAiGenerated?: boolean;
    whatsappMsgId?: string;
    status?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: data.conversationId,
          direction: data.direction,
          content: data.content,
          type: (data.type as 'TEXT') || 'TEXT',
          mediaUrl: data.mediaUrl,
          sentByUserId: data.sentByUserId,
          isAiGenerated: data.isAiGenerated ?? false,
          whatsappMsgId: data.whatsappMsgId,
          status: (data.status as 'PENDING') || 'PENDING',
          metadata: data.metadata,
        },
      });

      await tx.conversation.update({
        where: { id: data.conversationId },
        data: {
          lastMessageAt: new Date(),
          ...(data.direction === 'INBOUND' && { unreadCount: { increment: 1 } }),
        },
      });

      return message;
    });
  }

  async takeover(businessId: string, id: string, userId: string) {
    // Hybrid mode: assign agent but keep AI enabled for automatic replies
    return prisma.conversation.update({
      where: { id, businessId },
      data: {
        assignedToId: userId,
        isAiEnabled: true,
        status: 'OPEN',
      },
      include: {
        customer: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async transferToAi(businessId: string, id: string) {
    return prisma.conversation.update({
      where: { id, businessId },
      data: {
        assignedToId: null,
        isAiEnabled: true,
        status: 'OPEN',
      },
      include: {
        customer: true,
      },
    });
  }

  /** Human-only mode: disable AI auto-replies for this conversation. */
  async handoffToHuman(businessId: string, id: string, userId: string) {
    return prisma.conversation.update({
      where: { id, businessId },
      data: {
        assignedToId: userId,
        isAiEnabled: false,
        status: 'OPEN',
      },
      include: {
        customer: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async markAsRead(businessId: string, id: string) {
    return prisma.conversation.update({
      where: { id, businessId },
      data: { unreadCount: 0 },
    });
  }

  async findMessages(businessId: string, conversationId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
      select: { id: true },
    });

    if (!conversation) {
      return null;
    }

    return prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: {
        sentByUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findConversationWithWhatsApp(businessId: string, id: string) {
    return prisma.conversation.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        whatsappAccount: true,
      },
    });
  }
}

export const conversationsRepository = new ConversationsRepository();
