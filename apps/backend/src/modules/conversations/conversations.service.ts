import { conversationsRepository } from './conversations.repository';
import { NotFoundError, ValidationError, WhatsAppDeliveryError } from '../../core/errors';
import { PaginationInput, SendMessageInput } from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';
import { sendConversationMessage } from '../whatsapp/whatsapp-outbound.service';
import { resolveStoredToken } from '../../infrastructure/crypto/token-crypto';
import { whatsappRepository } from '../whatsapp/whatsapp.repository';
import { phoneDigits } from '../../core/utils/customer-phone';
import { broadcastConversationEvent } from '../../infrastructure/realtime/broadcast.service';
import { logger } from '../../core/logger';

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

  async getSummary(businessId: string) {
    return conversationsRepository.getSummary(businessId);
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
    logger.info('[Outbound] Agent send requested', {
      businessId,
      conversationId,
      userId,
      contentLength: input.content.length,
    });

    const conversation = await conversationsRepository.findConversationWithWhatsApp(
      businessId,
      conversationId
    );
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    let whatsappAccount = conversation.whatsappAccount;
    if (!whatsappAccount) {
      whatsappAccount = await whatsappRepository.findAccountByBusiness(businessId);
      if (whatsappAccount) {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { whatsappAccountId: whatsappAccount.id },
        });
        logger.info('[Outbound] Linked conversation to business WhatsApp account', {
          conversationId,
          whatsappAccountId: whatsappAccount.id,
        });
      }
    }

    if (!whatsappAccount?.isActive) {
      throw new ValidationError(
        'WhatsApp is not connected for this business. Connect WhatsApp in Settings before sending messages.'
      );
    }

    const accessToken = resolveStoredToken(whatsappAccount.accessToken);
    if (!accessToken) {
      throw new ValidationError(
        'WhatsApp access token is missing or could not be decrypted. Reconnect WhatsApp in Settings.'
      );
    }

    const recipientPhone =
      conversation.customer.whatsappId?.replace(/\D/g, '') ||
      phoneDigits(conversation.customer.phone);
    if (!recipientPhone || recipientPhone.length < 8) {
      throw new ValidationError('Customer phone number is invalid for WhatsApp delivery');
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

    logger.info('[Outbound] Message persisted as PENDING', {
      messageId: message.id,
      conversationId,
      recipientPhone,
      phoneNumberId: whatsappAccount.phoneNumberId,
    });

    const delivered = await sendConversationMessage({
      businessId,
      conversationId,
      messageId: message.id,
      phoneNumber: recipientPhone,
      phoneNumberId: whatsappAccount.phoneNumberId,
      content: input.content,
      type: input.type,
      mediaUrl: input.mediaUrl,
      mediaFilename: input.mediaFilename,
      accessToken,
    });

    if (!delivered.success) {
      const errorMessage =
        typeof delivered.error?.message === 'string'
          ? delivered.error.message
          : 'WhatsApp failed to deliver the message';
      throw new WhatsAppDeliveryError(errorMessage, delivered.error ?? undefined);
    }

    await prisma.customer.update({
      where: { id: conversation.customerId },
      data: { lastContactAt: new Date() },
    });

    void broadcastConversationEvent(businessId, {
      conversationId,
      type: 'message',
    }).catch((error) => logger.warn('[Outbound] Realtime broadcast failed', { error }));

    const updated = await prisma.message.findUnique({
      where: { id: message.id },
      include: {
        sentByUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    logger.info('[Outbound] Agent message delivered', {
      messageId: message.id,
      whatsappMsgId: delivered.whatsappMsgId,
      status: updated?.status,
    });

    return updated ?? message;
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

    const { whatsappService } = await import('../../infrastructure/whatsapp/whatsapp.service');
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
