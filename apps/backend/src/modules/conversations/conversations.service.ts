import { conversationsRepository } from './conversations.repository';
import { NotFoundError } from '../../core/errors';
import { PaginationInput, SendMessageInput } from '@smartreception/shared';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { getWhatsappQueue } from '../../infrastructure/queue/queues';
import { prisma } from '../../infrastructure/database/prisma';

export class ConversationsService {
  async list(
    businessId: string,
    params: PaginationInput & { status?: string; assignedToId?: string }
  ) {
    const result = await conversationsRepository.findMany(businessId, params);
    return {
      data: result.conversations,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  async get(businessId: string, id: string) {
    const conversation = await conversationsRepository.findById(businessId, id);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }
    return conversation;
  }

  async sendMessage(
    businessId: string,
    conversationId: string,
    input: SendMessageInput,
    userId: string
  ) {
    const conversation = await conversationsRepository.findConversationWithWhatsApp(
      businessId,
      conversationId
    );
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const message = await conversationsRepository.createMessage({
      conversationId,
      direction: 'OUTBOUND',
      content: input.content,
      type: input.type,
      sentByUserId: userId,
      isAiGenerated: false,
      status: 'PENDING',
    });

    if (conversation.whatsappAccount) {
      const queue = getWhatsappQueue();
      if (queue) {
        await queue.add('send-message', {
          businessId,
          conversationId,
          messageId: message.id,
          phoneNumber: conversation.customer.phone,
          content: input.content,
        });
      } else {
        await prisma.message.update({
          where: { id: message.id },
          data: { status: 'SENT' },
        });
      }
    } else {
      await prisma.message.update({
        where: { id: message.id },
        data: { status: 'SENT' },
      });
    }

    await prisma.customer.update({
      where: { id: conversation.customerId },
      data: { lastContactAt: new Date() },
    });

    return message;
  }

  async takeover(businessId: string, conversationId: string, userId: string) {
    const conversation = await conversationsRepository.findById(businessId, conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    return conversationsRepository.takeover(businessId, conversationId, userId);
  }

  async getMessages(businessId: string, conversationId: string) {
    const messages = await conversationsRepository.findMessages(businessId, conversationId);
    if (!messages) {
      throw new NotFoundError('Conversation not found');
    }
    return messages;
  }

  async markAsRead(businessId: string, conversationId: string) {
    const conversation = await conversationsRepository.findById(businessId, conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    return conversationsRepository.markAsRead(businessId, conversationId);
  }
}

export const conversationsService = new ConversationsService();
