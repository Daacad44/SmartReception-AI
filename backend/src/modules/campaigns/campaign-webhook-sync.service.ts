import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../core/logger';
import { advanceJourneyAfterStep } from './campaign-journey.service';
import { syncCampaignDeliveryStatsAndStatus } from './campaign-stats.service';
import type { WhatsAppWebhookError } from '../../infrastructure/whatsapp/whatsapp.types';

type WhatsAppStatus = 'sent' | 'delivered' | 'read' | 'failed';

const STATUS_RANK: Record<string, number> = {
  PENDING: 0,
  SENDING: 1,
  SENT: 2,
  FAILED: 3,
  DELIVERED: 4,
  READ: 5,
};

/** A terminal success cannot be downgraded by a late Meta status. */
export function canApplyCampaignWebhookStatus(current: string, incoming: WhatsAppStatus): boolean {
  const next = incoming.toUpperCase();
  if (current === next) return false;
  if (current === 'FAILED') return false;
  if (incoming === 'failed') return !['FAILED', 'DELIVERED', 'READ'].includes(current);
  if (incoming === 'sent') return (STATUS_RANK[current] ?? 0) < STATUS_RANK.SENT;
  return (STATUS_RANK[current] ?? 0) < STATUS_RANK[next];
}

export function deliveryFailureMetadata(errors: WhatsAppWebhookError[] | undefined, at: Date) {
  const error = errors?.[0];
  const failureCode = error?.code === undefined ? null : String(error.code);
  const explanation = error?.error_data?.details ?? error?.message ?? error?.title ?? 'Delivery failed';
  return {
    // Meta's `message` is often only a category (for example "Re-engagement
    // message"). Prefer error_data.details so Campaign Center shows the actual
    // corrective cause instead of an unhelpful heading.
    failedReason: failureCode ? `WhatsApp error ${failureCode}: ${explanation}` : explanation,
    failureCode,
    failureTitle: error?.title ?? null,
    failureMessage: error?.message ?? null,
    failureDetails: error?.error_data?.details ?? null,
    failureHref: error?.href ?? null,
    failedAt: at,
  };
}

/** Sync WhatsApp delivery webhooks to campaign recipient analytics. */
export async function syncCampaignRecipientFromWebhook(params: {
  whatsappMsgId: string;
  status: WhatsAppStatus;
  timestamp?: Date;
  errors?: WhatsAppWebhookError[];
}): Promise<string | null> {
  const recipient = await prisma.campaignRecipient.findFirst({
    where: { whatsappMsgId: params.whatsappMsgId },
    include: { campaign: { select: { id: true, businessId: true, journeyId: true } } },
  });
  if (!recipient) return null;

  const at = params.timestamp ?? new Date();
  const campaignId = recipient.campaign.id;
  const businessId = recipient.campaign.businessId;

  if (!canApplyCampaignWebhookStatus(recipient.status, params.status)) return campaignId;

  if (params.status === 'delivered') {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: {
        status: 'DELIVERED',
        deliveredAt: at,
        failedReason: null,
        failureCode: null,
        failureTitle: null,
        failureMessage: null,
        failureDetails: null,
        failureHref: null,
        failedAt: null,
      },
    });
    await syncCampaignDeliveryStatsAndStatus(campaignId);
    return campaignId;
  }

  if (params.status === 'read') {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: 'READ', readAt: at },
    });
    await syncCampaignDeliveryStatsAndStatus(campaignId);
    return campaignId;
  }

  if (params.status === 'failed') {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: {
        status: 'FAILED',
        ...deliveryFailureMetadata(params.errors, at),
      },
    });
    await syncCampaignDeliveryStatsAndStatus(campaignId);
    return campaignId;
  }

  if (params.status === 'sent') {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: 'SENT', sentAt: recipient.sentAt ?? at },
    });
    await syncCampaignDeliveryStatsAndStatus(campaignId);
  }

  if (params.status === 'sent' && recipient.campaign.journeyId) {
    void advanceJourneyAfterStep(businessId, recipient.campaign.journeyId, recipient.customerId).catch(
      (error) => logger.warn('Journey advance failed', { error })
    );
  }
  return campaignId;
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
