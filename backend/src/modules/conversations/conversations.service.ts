import { conversationsRepository } from './conversations.repository';
import { NotFoundError, ValidationError, WhatsAppDeliveryError } from '../../core/errors';
import { PaginationInput, SendMessageInput } from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';
import type { Prisma } from '@prisma/client';
import { sendConversationMessage } from '../whatsapp/whatsapp-outbound.service';
import { resolveStoredToken } from '../../infrastructure/crypto/token-crypto';
import { whatsappRepository } from '../whatsapp/whatsapp.repository';
import { phoneDigits } from '../../core/utils/customer-phone';
import { broadcastConversationEvent } from '../../infrastructure/realtime/broadcast.service';
import { messageTemplatesService } from '../message-templates/message-templates.service';
import {
  formatSessionExpiryMessage,
  getWhatsAppSessionWindow,
} from '../whatsapp/whatsapp-session.service';
import { resolveConversationTemplateSend } from '../whatsapp/conversation-template.service';
import { logger } from '../../core/logger';
import { listConversationActivities } from './conversation-activity.service';
import {
  assignConversation,
  closeConversation,
  initiateHumanHandoff,
  resolveConversation,
  transferConversation,
} from './conversation-handoff.service';
import { getConversationFeedback } from './conversation-feedback.service';
import type { ConversationTeam } from '@prisma/client';

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
    const whatsappSession = await getWhatsAppSessionWindow(id, conversation.customerId);
    return { ...conversation, whatsappSession };
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
      contentLength: input.content?.length ?? 0,
      templateId: input.templateId,
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

    const sessionWindow = await getWhatsAppSessionWindow(conversationId, conversation.customerId);

    let outboundContent = input.content?.trim() ?? '';
    let outboundType = input.type ?? 'TEXT';
    let templateMeta:
      | {
          templateId: string;
          templateName: string;
          templateNameMeta?: string;
          templateLanguage?: string;
          templateComponents?: unknown[];
        }
      | undefined;

    if (input.templateId) {
      const resolved = await resolveConversationTemplateSend({
        businessId,
        conversationId,
        customerId: conversation.customerId,
        templateId: input.templateId,
        whatsappAccountId: whatsappAccount.id,
      });
      outboundContent = resolved.content;
      outboundType = resolved.messageType;
      templateMeta = {
        templateId: resolved.templateId,
        templateName: resolved.templateName,
        templateNameMeta: resolved.templateNameMeta,
        templateLanguage: resolved.templateLanguage,
        templateComponents: resolved.templateComponents,
      };
    } else if (!sessionWindow.isOpen) {
      const sessionMessage = formatSessionExpiryMessage(sessionWindow);
      logger.warn('[Outbound] Blocked agent send — WhatsApp session closed', {
        conversationId,
        customerId: conversation.customerId,
        lastInboundAt: sessionWindow.lastInboundAt,
        expiresAt: sessionWindow.expiresAt,
      });
      throw new ValidationError(sessionMessage);
    }

    if (!outboundContent) {
      throw new ValidationError('Message content is required');
    }

    const message = await conversationsRepository.createMessage({
      conversationId,
      direction: 'OUTBOUND',
      content: outboundContent,
      type: outboundType,
      mediaUrl: input.mediaUrl,
      sentByUserId: userId,
      isAiGenerated: false,
      status: 'PENDING',
      metadata: templateMeta ? ({ template: templateMeta } as Prisma.InputJsonValue) : undefined,
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
      content: outboundContent,
      type: outboundType,
      mediaUrl: input.mediaUrl,
      mediaFilename: input.mediaFilename,
      accessToken,
      templateName: templateMeta?.templateNameMeta,
      templateLanguage: templateMeta?.templateLanguage,
      templateComponents: templateMeta?.templateComponents,
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
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
      select: { id: true, customerId: true },
    });
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const [messages, whatsappSession] = await Promise.all([
      conversationsRepository.findMessages(businessId, conversationId),
      getWhatsAppSessionWindow(conversationId, conversation.customerId),
    ]);

    return { messages: messages ?? [], whatsappSession };
  }

  async markAsRead(businessId: string, conversationId: string) {
    const conversation = await conversationsRepository.exists(businessId, conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    return conversationsRepository.markAsRead(businessId, conversationId);
  }

  async transferToAi(businessId: string, conversationId: string, actorUserId: string) {
    const conversation = await conversationsRepository.exists(businessId, conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    return conversationsRepository.transferToAi(businessId, conversationId, actorUserId);
  }

  async handoffToHuman(businessId: string, conversationId: string, userId: string) {
    const conversation = await conversationsRepository.exists(businessId, conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    return conversationsRepository.handoffToHuman(businessId, conversationId, userId);
  }

  async listTemplates(businessId: string) {
    return messageTemplatesService.listForInbox(businessId);
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

  async assign(
    businessId: string,
    conversationId: string,
    assigneeId: string,
    actorUserId: string,
    team?: ConversationTeam | null
  ) {
    const result = await assignConversation({
      businessId,
      conversationId,
      assigneeId,
      team,
      actorUserId,
    });
    if (!result) {
      throw new NotFoundError('Conversation or assignee not found');
    }
    return result;
  }

  async transfer(
    businessId: string,
    conversationId: string,
    actorUserId: string,
    assigneeId?: string | null,
    team?: ConversationTeam | null
  ) {
    const result = await transferConversation({
      businessId,
      conversationId,
      actorUserId,
      assigneeId,
      team,
    });
    if (!result) {
      throw new NotFoundError('Conversation not found');
    }
    return result;
  }

  async resolve(businessId: string, conversationId: string, actorUserId: string) {
    const conversation = await conversationsRepository.findById(businessId, conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    return resolveConversation({
      businessId,
      conversationId,
      actorUserId,
      resolutionMethod: conversation.assignedToId ? 'HUMAN' : 'AI',
    });
  }

  async close(businessId: string, conversationId: string, actorUserId: string) {
    const conversation = await conversationsRepository.exists(businessId, conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    return closeConversation({ businessId, conversationId, actorUserId });
  }

  async requestHuman(
    businessId: string,
    conversationId: string,
    actorUserId: string,
    reason?: string
  ) {
    const conversation = await conversationsRepository.exists(businessId, conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    return initiateHumanHandoff({
      businessId,
      conversationId,
      reason: reason ?? 'Human support requested by team',
      actorUserId,
    });
  }

  async getActivity(businessId: string, conversationId: string) {
    const conversation = await conversationsRepository.exists(businessId, conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    return listConversationActivities(businessId, conversationId);
  }

  async getFeedback(businessId: string, conversationId: string) {
    const conversation = await conversationsRepository.exists(businessId, conversationId);
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    return getConversationFeedback(businessId, conversationId);
  }
}

export const conversationsService = new ConversationsService();
