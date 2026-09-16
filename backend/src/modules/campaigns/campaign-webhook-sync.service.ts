import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../core/logger';
import { advanceJourneyAfterStep } from './campaign-journey.service';
import { syncCampaignDeliveryStatsAndStatus } from './campaign-stats.service';

type WhatsAppStatus = 'sent' | 'delivered' | 'read' | 'failed';

/** Sync WhatsApp delivery webhooks to campaign recipient analytics. */
export async function syncCampaignRecipientFromWebhook(params: {
  whatsappMsgId: string;
  status: WhatsAppStatus;
  timestamp?: Date;
  errorMessage?: string;
}): Promise<void> {
  const recipient = await prisma.campaignRecipient.findFirst({
    where: { whatsappMsgId: params.whatsappMsgId },
    include: { campaign: { select: { id: true, businessId: true, journeyId: true } } },
  });
  if (!recipient) return;

  const at = params.timestamp ?? new Date();
  const campaignId = recipient.campaign.id;
  const businessId = recipient.campaign.businessId;

  if (params.status === 'delivered') {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: 'DELIVERED', deliveredAt: at },
    });
    await syncCampaignDeliveryStatsAndStatus(campaignId);
    return;
  }

  if (params.status === 'read') {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: 'READ', readAt: at },
    });
    await syncCampaignDeliveryStatsAndStatus(campaignId);
    return;
  }

  if (params.status === 'failed') {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: 'FAILED', failedReason: params.errorMessage ?? 'Delivery failed' },
    });
    await syncCampaignDeliveryStatsAndStatus(campaignId);
    return;
  }

  if (params.status === 'sent' && recipient.campaign.journeyId) {
    void advanceJourneyAfterStep(businessId, recipient.campaign.journeyId, recipient.customerId).catch(
      (error) => logger.warn('Journey advance failed', { error })
    );
  }
}

/** Mark campaign recipient as replied when customer sends inbound message after campaign. */
export async function markCampaignResponse(
  businessId: string,
  customerId: string,
  withinHours = 72
): Promise<void> {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  const recipient = await prisma.campaignRecipient.findFirst({
    where: {
      customerId,
      isSent: true,
      respondedAt: null,
      sentAt: { gte: since },
      campaign: { businessId },
    },
    orderBy: { sentAt: 'desc' },
  });
  if (!recipient) return;

  await prisma.$transaction([
    prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { respondedAt: new Date() },
    }),
    prisma.campaign.update({
      where: { id: recipient.campaignId },
      data: { responseCount: { increment: 1 } },
    }),
  ]);
}
