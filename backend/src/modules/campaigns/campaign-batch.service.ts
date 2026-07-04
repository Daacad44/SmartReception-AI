import { prisma } from '../../infrastructure/database/prisma';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { resolveStoredToken } from '../../infrastructure/crypto/token-crypto';
import { personalizeCampaignMessage } from './campaign-personalization.service';
import { syncCampaignDeliveryStats } from './campaign-stats.service';
import { logger } from '../../core/logger';
import type { CampaignMessageType } from '@prisma/client';

const BATCH_SIZE = 50;

export type CampaignBatchJobData = {
  businessId: string;
  campaignId: string;
  recipientIds: string[];
  runVersion: number;
};

export async function sendCampaignBatch(data: CampaignBatchJobData): Promise<{ sent: number; failed: number }> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: data.campaignId, businessId: data.businessId },
    include: {
      business: { include: { whatsappAccounts: { where: { isActive: true }, take: 1 } } },
    },
  });
  if (!campaign || ['CANCELLED', 'PAUSED', 'ARCHIVED'].includes(campaign.status)) {
    return { sent: 0, failed: 0 };
  }

  const whatsappAccount = campaign.business.whatsappAccounts[0];
  if (!whatsappAccount) return { sent: 0, failed: data.recipientIds.length };

  await prisma.campaignRecipient.updateMany({
    where: {
      id: { in: data.recipientIds },
      campaignId: data.campaignId,
      status: 'SENDING',
      isSent: false,
      whatsappMsgId: null,
    },
    data: { status: 'PENDING' },
  });

  const recipients = await prisma.campaignRecipient.findMany({
    where: {
      id: { in: data.recipientIds },
      campaignId: data.campaignId,
      isSent: false,
      status: 'PENDING',
      runVersion: data.runVersion,
    },
    include: { customer: true },
  });

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      const optedOut = await prisma.customerCampaignOptOut.findUnique({
        where: {
          businessId_customerId: { businessId: data.businessId, customerId: recipient.customerId },
        },
      });
      if (optedOut) {
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: { status: 'FAILED', isSent: true, failedReason: 'Customer opted out' },
        });
        failed++;
        continue;
      }

      const claimed = await prisma.campaignRecipient.updateMany({
        where: { id: recipient.id, isSent: false, status: 'PENDING', runVersion: data.runVersion },
        data: { status: 'SENDING' },
      });
      if (claimed.count === 0) continue;

      const content = personalizeCampaignMessage(campaign.message, {
        businessName: campaign.business.name,
        customer: recipient.customer,
      });

      const phone = recipient.customer.whatsappNumber || recipient.customer.phone;
      const messageType = mapMessageType(campaign.messageType);

      const result = await whatsappService.sendOutbound({
        phoneNumberId: whatsappAccount.phoneNumberId,
        to: phone,
        accessToken: resolveStoredToken(whatsappAccount.accessToken),
        type: messageType,
        content,
        mediaUrl: campaign.mediaUrl ?? undefined,
        mediaFilename: campaign.mediaFilename ?? undefined,
      });

      if (result.success) {
        sent++;
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'SENT',
            isSent: true,
            whatsappMsgId: result.whatsappMsgId,
            sentAt: new Date(),
          },
        });
      } else {
        failed++;
        const reason = result.error?.message || 'Send failed';
        const isBlocked = /blocked|opt|131026|131047/i.test(reason);
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'FAILED',
            isSent: true,
            failedReason: reason,
          },
        });
        if (isBlocked) {
          await prisma.campaign.update({
            where: { id: campaign.id },
            data: { blockedCount: { increment: 1 } },
          });
        }
      }
    } catch (error) {
      failed++;
      const reason = error instanceof Error ? error.message : 'Send failed';
      await prisma.campaignRecipient.updateMany({
        where: { id: recipient.id, isSent: false },
        data: { status: 'FAILED', isSent: true, failedReason: reason },
      });
      logger.error('Campaign recipient send failed', { campaignId: data.campaignId, recipientId: recipient.id, error });
    }
  }

  if (sent > 0 || failed > 0) {
    await syncCampaignDeliveryStats(data.campaignId);
    const { broadcastBusinessEvent } = await import('../../infrastructure/realtime/broadcast.service');
    void broadcastBusinessEvent(data.businessId, { type: 'campaign', campaignId: data.campaignId, action: 'progress' });
  }

  logger.debug('Campaign batch processed', { campaignId: data.campaignId, sent, failed });
  await finalizeCampaignIfComplete(data.campaignId, data.businessId);

  const remaining = await prisma.campaignRecipient.count({
    where: {
      campaignId: data.campaignId,
      isSent: false,
      status: 'PENDING',
      runVersion: data.runVersion,
    },
  });
  if (remaining > 0) {
    const { getCampaignBatchQueue } = await import('../../infrastructure/queue/queues');
    if (!getCampaignBatchQueue()) {
      await enqueueCampaignBatches(data.campaignId, data.businessId, data.runVersion);
    }
  }

  return { sent, failed };
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

export async function enqueueCampaignBatches(
  campaignId: string,
  businessId: string,
  runVersion: number
): Promise<number> {
  const recipientIds = await prisma.campaignRecipient.findMany({
    where: { campaignId, isSent: false, status: 'PENDING', runVersion },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  const { getCampaignBatchQueue } = await import('../../infrastructure/queue/queues');
  const queue = getCampaignBatchQueue();
  let batches = 0;

  for (let i = 0; i < recipientIds.length; i += BATCH_SIZE) {
    const chunk = recipientIds.slice(i, i + BATCH_SIZE).map((r) => r.id);
    if (queue) {
      await queue.add(
        'campaign-batch',
        { businessId, campaignId, recipientIds: chunk, runVersion },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true }
      );
    } else {
      await sendCampaignBatch({ businessId, campaignId, recipientIds: chunk, runVersion });
    }
    batches++;
  }

  return batches;
}

export async function finalizeCampaignIfComplete(campaignId: string, businessId: string): Promise<void> {
  const pending = await prisma.campaignRecipient.count({
    where: { campaignId, isSent: false, status: { in: ['PENDING', 'SENDING'] } },
  });
  if (pending > 0) return;

  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, businessId } });
  if (!campaign || ['COMPLETED', 'CANCELLED', 'ARCHIVED'].includes(campaign.status)) return;

  const { computeNextCampaignRun, shouldStopRecurring } = await import('./campaign-scheduler.service');
  const { enqueueCampaignSend } = await import('./campaign-queue.utils');
  const { broadcastBusinessEvent } = await import('../../infrastructure/realtime/broadcast.service');

  const isRecurring = campaign.schedule !== 'ONE_TIME';
  const runsCompleted = campaign.runsCompleted + 1;
  const stop = shouldStopRecurring({
    runsCompleted,
    repeatCount: campaign.repeatCount,
    repeatUntil: campaign.repeatUntil,
  });

  const nextRunAt =
    isRecurring && !stop
      ? computeNextCampaignRun({
          schedule: campaign.schedule,
          from: new Date(),
          scheduleConfig: campaign.scheduleConfig as import('./campaign-scheduler.service').ScheduleConfig,
          cronExpression: campaign.cronExpression,
        })
      : null;

  const oneTimeComplete = !isRecurring || stop;
  const nextRunVersion = campaign.runVersion + 1;

  const agg = await prisma.campaignRecipient.groupBy({
    by: ['status'],
    where: { campaignId, runVersion: campaign.runVersion },
    _count: { status: true },
  });
  const sent = agg
    .filter((a) => ['SENT', 'DELIVERED', 'READ'].includes(a.status))
    .reduce((sum, a) => sum + a._count.status, 0);
  const failed = agg
    .filter((a) => a.status === 'FAILED')
    .reduce((sum, a) => sum + a._count.status, 0);

  await syncCampaignDeliveryStats(campaignId);

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: failed > 0 && sent === 0 ? 'FAILED' : oneTimeComplete ? 'COMPLETED' : 'SCHEDULED',
      isSent: oneTimeComplete,
      lastRunAt: new Date(),
      runsCompleted,
      nextRunAt: oneTimeComplete ? null : nextRunAt,
      runVersion: isRecurring && !stop ? nextRunVersion : undefined,
    },
  });

  if (isRecurring && nextRunAt && !stop) {
    await prisma.campaignRecipient.updateMany({
      where: { campaignId },
      data: { isSent: false, status: 'PENDING', runVersion: nextRunVersion },
    });
    await enqueueCampaignSend(campaignId, businessId, nextRunAt, `${campaignId}-${nextRunAt.getTime()}`);
  }

  if (sent > 0 || failed > 0) {
    await prisma.notification.create({
      data: {
        businessId,
        type: failed > 0 ? 'CAMPAIGN_FAILED' : 'CAMPAIGN_DELIVERED',
        title: failed > 0 ? 'Campaign partially failed' : 'Campaign delivered',
        message: `${campaign.name}: ${sent} sent, ${failed} failed`,
        data: { campaignId },
      },
    });
    void broadcastBusinessEvent(businessId, { type: 'campaign', campaignId, action: 'sent' });
  }
}
