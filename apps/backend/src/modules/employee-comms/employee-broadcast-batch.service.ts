import { prisma } from '../../infrastructure/database/prisma';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { resolveStoredToken } from '../../infrastructure/crypto/token-crypto';
import { personalizeEmployeeMessage } from './employee-personalization.service';
import { logger } from '../../core/logger';
import type { CampaignMessageType } from '@prisma/client';

const BATCH_SIZE = 50;

export type EmployeeBroadcastBatchJobData = {
  businessId: string;
  broadcastId: string;
  recipientIds: string[];
  runVersion: number;
};

export async function sendEmployeeBroadcastBatch(
  data: EmployeeBroadcastBatchJobData
): Promise<{ sent: number; failed: number }> {
  const broadcast = await prisma.employeeBroadcast.findFirst({
    where: { id: data.broadcastId, businessId: data.businessId },
    include: {
      business: { include: { whatsappAccounts: { where: { isActive: true }, take: 1 } } },
    },
  });
  if (!broadcast || ['CANCELLED', 'PAUSED', 'ARCHIVED'].includes(broadcast.status)) {
    return { sent: 0, failed: 0 };
  }

  const whatsappAccount = broadcast.business.whatsappAccounts[0];
  if (!whatsappAccount) return { sent: 0, failed: data.recipientIds.length };

  const recipients = await prisma.employeeBroadcastRecipient.findMany({
    where: {
      id: { in: data.recipientIds },
      broadcastId: data.broadcastId,
      isSent: false,
      status: 'PENDING',
      runVersion: data.runVersion,
    },
    include: { employee: true },
  });

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    if (recipient.employee.status !== 'ACTIVE' || !recipient.employee.isActive) {
      await prisma.employeeBroadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: 'FAILED', isSent: true, failedReason: 'Employee inactive' },
      });
      failed++;
      continue;
    }

    const claimed = await prisma.employeeBroadcastRecipient.updateMany({
      where: { id: recipient.id, isSent: false, status: 'PENDING', runVersion: data.runVersion },
      data: { status: 'SENDING' },
    });
    if (claimed.count === 0) continue;

    const content = personalizeEmployeeMessage(broadcast.message, {
      businessName: broadcast.business.name,
      employee: recipient.employee,
    });

    const phone = recipient.employee.whatsappNumber || recipient.employee.phone;
    const messageType = mapMessageType(broadcast.messageType);

    const result = await whatsappService.sendOutbound({
      phoneNumberId: whatsappAccount.phoneNumberId,
      to: phone,
      accessToken: resolveStoredToken(whatsappAccount.accessToken),
      type: messageType,
      content,
      mediaUrl: broadcast.mediaUrl ?? undefined,
      mediaFilename: broadcast.mediaFilename ?? undefined,
    });

    if (result.success) {
      sent++;
      await prisma.employeeBroadcastRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'SENT',
          isSent: true,
          whatsappMsgId: result.whatsappMsgId,
          sentAt: new Date(),
        },
      });
      await ensureEmployeeConversation(data.businessId, recipient.employeeId, whatsappAccount.id);
    } else {
      failed++;
      await prisma.employeeBroadcastRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'FAILED',
          isSent: true,
          failedReason: result.error?.message || 'Send failed',
          retryCount: { increment: 1 },
        },
      });
    }
  }

  logger.debug('Employee broadcast batch processed', { broadcastId: data.broadcastId, sent, failed });
  await finalizeEmployeeBroadcastIfComplete(data.broadcastId, data.businessId);
  return { sent, failed };
}

async function ensureEmployeeConversation(
  businessId: string,
  employeeId: string,
  whatsappAccountId: string
): Promise<void> {
  await prisma.employeeConversation.upsert({
    where: { businessId_employeeId: { businessId, employeeId } },
    create: { businessId, employeeId, whatsappAccountId, status: 'OPEN' },
    update: { whatsappAccountId },
  });
}

function mapMessageType(type: CampaignMessageType): 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'AUDIO' {
  switch (type) {
    case 'IMAGE':
      return 'IMAGE';
    case 'DOCUMENT':
      return 'DOCUMENT';
    case 'VIDEO':
      return 'VIDEO';
    case 'AUDIO':
      return 'AUDIO';
    default:
      return 'TEXT';
  }
}

export async function enqueueEmployeeBroadcastBatches(
  broadcastId: string,
  businessId: string,
  runVersion: number
): Promise<number> {
  const recipientIds = await prisma.employeeBroadcastRecipient.findMany({
    where: { broadcastId, isSent: false, status: 'PENDING', runVersion },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  const { getEmployeeBroadcastBatchQueue } = await import('../../infrastructure/queue/queues');
  const queue = getEmployeeBroadcastBatchQueue();
  let batches = 0;

  for (let i = 0; i < recipientIds.length; i += BATCH_SIZE) {
    const chunk = recipientIds.slice(i, i + BATCH_SIZE).map((r) => r.id);
    if (queue) {
      await queue.add(
        'employee-broadcast-batch',
        { businessId, broadcastId, recipientIds: chunk, runVersion },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true }
      );
    } else {
      await sendEmployeeBroadcastBatch({
        businessId,
        broadcastId,
        recipientIds: chunk,
        runVersion,
      });
    }
    batches++;
  }
  return batches;
}

export async function finalizeEmployeeBroadcastIfComplete(
  broadcastId: string,
  businessId: string
): Promise<void> {
  const pending = await prisma.employeeBroadcastRecipient.count({
    where: { broadcastId, isSent: false, status: { in: ['PENDING', 'SENDING', 'QUEUED'] } },
  });
  if (pending > 0) return;

  const broadcast = await prisma.employeeBroadcast.findFirst({
    where: { id: broadcastId, businessId },
  });
  if (!broadcast || broadcast.status === 'COMPLETED') return;

  const [sent, delivered, failed, read] = await Promise.all([
    prisma.employeeBroadcastRecipient.count({ where: { broadcastId, isSent: true } }),
    prisma.employeeBroadcastRecipient.count({ where: { broadcastId, status: 'DELIVERED' } }),
    prisma.employeeBroadcastRecipient.count({ where: { broadcastId, status: 'FAILED' } }),
    prisma.employeeBroadcastRecipient.count({ where: { broadcastId, status: 'READ' } }),
  ]);

  await prisma.employeeBroadcast.update({
    where: { id: broadcastId },
    data: {
      status: 'COMPLETED',
      sentCount: sent,
      deliveredCount: delivered,
      failedCount: failed,
      readCount: read,
      lastRunAt: new Date(),
    },
  });
}
