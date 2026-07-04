import { prisma } from '../../infrastructure/database/prisma';
import { normalizePhone } from '../../core/utils/phone';
import {
  isMenuOnlyTrigger,
  parseMenuSelection,
} from '../../infrastructure/ai/somali-menu';
import type { WhatsAppWebhookMessage } from '../../infrastructure/whatsapp/whatsapp.types';

export interface HandleEmployeeInboundParams {
  businessId: string;
  whatsappAccountId: string;
  msg: WhatsAppWebhookMessage;
  extracted: {
    type: string;
    content: string;
    mediaId?: string;
    filename?: string;
  };
}

async function findEmployeeByPhone(businessId: string, from: string) {
  const normalized = normalizePhone(from);
  const digits = normalized.replace(/\D/g, '');
  const employees = await prisma.employee.findMany({
    where: { businessId, isActive: true, status: 'ACTIVE' },
    select: { id: true, phone: true, whatsappNumber: true },
  });
  return employees.find((e) => {
    const phones = [e.phone, e.whatsappNumber].filter(Boolean) as string[];
    return phones.some((p) => {
      const d = normalizePhone(p).replace(/\D/g, '');
      return d === digits || d.endsWith(digits) || digits.endsWith(d);
    });
  });
}

function isCustomerFacingMenuMessage(content: string): boolean {
  const text = content.trim();
  if (!text) return true;
  return isMenuOnlyTrigger(text) || parseMenuSelection(text) !== null;
}

export async function tryHandleEmployeeInbound(
  params: HandleEmployeeInboundParams
): Promise<boolean> {
  const employee = await findEmployeeByPhone(params.businessId, params.msg.from);
  if (!employee) return false;

  const recentRecipient = await prisma.employeeBroadcastRecipient.findFirst({
    where: {
      employeeId: employee.id,
      broadcast: { businessId: params.businessId },
      isSent: true,
      respondedAt: null,
    },
    orderBy: { sentAt: 'desc' },
  });

  // Employees often test the customer bot from their own phone — don't swallow greetings
  // or menu picks unless they are replying to an active employee broadcast.
  if (isCustomerFacingMenuMessage(params.extracted.content) && !recentRecipient) {
    return false;
  }

  const conversation = await prisma.employeeConversation.upsert({
    where: {
      businessId_employeeId: { businessId: params.businessId, employeeId: employee.id },
    },
    create: {
      businessId: params.businessId,
      employeeId: employee.id,
      whatsappAccountId: params.whatsappAccountId,
      status: 'OPEN',
      unreadCount: 1,
      lastMessageAt: new Date(),
    },
    update: {
      unreadCount: { increment: 1 },
      lastMessageAt: new Date(),
      isArchived: false,
      status: 'OPEN',
    },
  });

  await prisma.employeeConversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      content: params.extracted.content,
      type: params.extracted.type,
      status: 'DELIVERED',
      whatsappMsgId: params.msg.id,
      mediaUrl: params.extracted.mediaId,
      mediaFilename: params.extracted.filename,
    },
  });

  await prisma.employee.update({
    where: { id: employee.id },
    data: { lastActiveAt: new Date() },
  });

  if (recentRecipient) {
    await prisma.$transaction([
      prisma.employeeBroadcastRecipient.update({
        where: { id: recentRecipient.id },
        data: { respondedAt: new Date(), status: 'READ' },
      }),
      prisma.employeeBroadcast.update({
        where: { id: recentRecipient.broadcastId },
        data: { responseCount: { increment: 1 } },
      }),
    ]);
  }

  return true;
}
