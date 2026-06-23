import { conversationsRepository } from './conversations.repository';
import { NotFoundError } from '../../core/errors';
import { PaginationInput, SendMessageInput } from '@smartreception/shared';
import { getWhatsappQueue } from '../../infrastructure/queue/queues';
import { prisma } from '../../infrastructure/database/prisma';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { sendConversationMessage } from '../whatsapp/whatsapp-outbound.service';
import { resolveStoredToken } from '../../infrastructure/crypto/token-crypto';

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
      mediaUrl: input.mediaUrl,
      sentByUserId: userId,
      isAiGenerated: false,
      status: 'PENDING',
    });

    if (conversation.whatsappAccount) {
      const queue = getWhatsappQueue();
      if (queue) {
        await queue.add(
          'send-message',
          {
            businessId,
            conversationId,
            messageId: message.id,
            phoneNumber: conversation.customer.phone,
            content: input.content,
            type: input.type,
            mediaUrl: input.mediaUrl,
            mediaFilename: input.mediaFilename,
          },
          { removeOnComplete: true, removeOnFail: 100 }
        );
      } else {
        await sendConversationMessage({
          businessId,
          conversationId,
          messageId: message.id,
          phoneNumber: conversation.customer.phone,
          phoneNumberId: conversation.whatsappAccount.phoneNumberId,
          content: input.content,
          type: input.type,
          mediaUrl: input.mediaUrl,
          mediaFilename: input.mediaFilename,
          accessToken: resolveStoredToken(conversation.whatsappAccount.accessToken),
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
    const conversation = await conversationsRepository.exists(businessId, conversationId);
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
    const conversation = await conversationsRepository.exists(businessId, conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    return conversationsRepository.markAsRead(businessId, conversationId);
  }

  async transferToAi(businessId: string, conversationId: string) {
    const conversation = await conversationsRepository.exists(businessId, conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    return conversationsRepository.transferToAi(businessId, conversationId);
  }

  async handoffToHuman(businessId: string, conversationId: string, userId: string) {
    const conversation = await conversationsRepository.exists(businessId, conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    return conversationsRepository.handoffToHuman(businessId, conversationId, userId);
  }

  async sendTypingIndicator(businessId: string, conversationId: string) {
    const conversation = await conversationsRepository.findConversationWithWhatsApp(
      businessId,
      conversationId
    );
    if (!conversation?.whatsappAccount) {
      return { sent: false };
    }

    await whatsappService.sendTypingIndicator(
      conversation.whatsappAccount.phoneNumberId,
      conversation.customer.phone,
      resolveStoredToken(conversation.whatsappAccount.accessToken)
    );

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { isTyping: true },
    });

    return { sent: true };
  }
}

export const conversationsService = new ConversationsService();
