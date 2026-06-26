import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../core/errors';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { resolveStoredToken } from '../../infrastructure/crypto/token-crypto';
import type { PaginationInput } from '@smartreception/shared';

export class EmployeeInboxService {
  async listConversations(businessId: string, params: PaginationInput & { archived?: boolean; groupId?: string }) {
    const { page, limit, search, groupId } = params;
    const skip = (page - 1) * limit;

    let employeeIds: string[] | undefined;
    if (groupId) {
      const members = await prisma.employeeGroupMember.findMany({
        where: { groupId, employee: { businessId } },
        select: { employeeId: true },
      });
      employeeIds = members.map((m) => m.employeeId);
      if (!employeeIds.length) return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }

    const where = {
      businessId,
      isArchived: params.archived ?? false,
      ...(employeeIds && { employeeId: { in: employeeIds } }),
      ...(search && {
        employee: {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        },
      }),
    };
    const [data, total] = await Promise.all([
      prisma.employeeConversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          employee: { select: { id: true, fullName: true, phone: true, department: true, jobTitle: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      prisma.employeeConversation.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getConversation(businessId: string, id: string) {
    const conversation = await prisma.employeeConversation.findFirst({
      where: { id, businessId },
      include: {
        employee: true,
        messages: { orderBy: { createdAt: 'asc' }, take: 200 },
      },
    });
    if (!conversation) throw new NotFoundError('Conversation not found');
    await prisma.employeeConversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });
    return conversation;
  }

  async sendReply(
    businessId: string,
    conversationId: string,
    content: string,
    userId: string
  ) {
    const conversation = await prisma.employeeConversation.findFirst({
      where: { id: conversationId, businessId },
      include: { employee: true },
    });
    if (!conversation) throw new NotFoundError('Conversation not found');

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { whatsappAccounts: { where: { isActive: true }, take: 1 } },
    });
    const whatsapp = business?.whatsappAccounts[0];
    if (!whatsapp) throw new NotFoundError('WhatsApp not connected');

    const phone = conversation.employee.whatsappNumber || conversation.employee.phone;
    const result = await whatsappService.sendOutbound({
      phoneNumberId: whatsapp.phoneNumberId,
      to: phone,
      accessToken: resolveStoredToken(whatsapp.accessToken),
      type: 'TEXT',
      content,
    });

    const message = await prisma.employeeConversationMessage.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        content,
        type: 'TEXT',
        status: result.success ? 'SENT' : 'FAILED',
        whatsappMsgId: result.whatsappMsgId,
        metadata: { sentByUserId: userId } as object,
      },
    });

    await prisma.employeeConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }

  async archive(businessId: string, id: string) {
    await prisma.employeeConversation.updateMany({
      where: { id, businessId },
      data: { isArchived: true },
    });
  }
}

export const employeeInboxService = new EmployeeInboxService();

/** Sync WhatsApp delivery webhooks to employee broadcast recipients. */
export async function syncEmployeeRecipientFromWebhook(params: {
  whatsappMsgId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp?: Date;
  errorMessage?: string;
}): Promise<void> {
  const recipient = await prisma.employeeBroadcastRecipient.findFirst({
    where: { whatsappMsgId: params.whatsappMsgId },
    include: { broadcast: { select: { id: true, businessId: true } } },
  });
  if (!recipient) return;

  const at = params.timestamp ?? new Date();
  const broadcastId = recipient.broadcast.id;

  if (params.status === 'delivered') {
    await prisma.$transaction([
      prisma.employeeBroadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: 'DELIVERED', deliveredAt: at },
      }),
      prisma.employeeBroadcast.update({
        where: { id: broadcastId },
        data: { deliveredCount: { increment: 1 } },
      }),
    ]);
    return;
  }

  if (params.status === 'read') {
    await prisma.$transaction([
      prisma.employeeBroadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: 'READ', readAt: at },
      }),
      prisma.employeeBroadcast.update({
        where: { id: broadcastId },
        data: { readCount: { increment: 1 } },
      }),
    ]);
    return;
  }

  if (params.status === 'failed') {
    await prisma.employeeBroadcastRecipient.update({
      where: { id: recipient.id },
      data: { status: 'FAILED', failedReason: params.errorMessage ?? 'Delivery failed' },
    });
    await prisma.employeeBroadcast.update({
      where: { id: broadcastId },
      data: { failedCount: { increment: 1 } },
    });
  }
}
