import type { SubscriptionPlan } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { ValidationError } from '../../core/errors';

export type CampaignPlanLimits = {
  maxActiveCampaigns: number;
  maxScheduledMessagesPerMonth: number;
  segmentation: boolean;
  aiGenerator: boolean;
  journeys: boolean;
  priorityQueue: boolean;
};

const PLAN_LIMITS: Record<SubscriptionPlan, CampaignPlanLimits> = {
  FREE: { maxActiveCampaigns: 1, maxScheduledMessagesPerMonth: 50, segmentation: false, aiGenerator: false, journeys: false, priorityQueue: false },
  STARTER: { maxActiveCampaigns: 5, maxScheduledMessagesPerMonth: 500, segmentation: false, aiGenerator: false, journeys: false, priorityQueue: false },
  BUSINESS: { maxActiveCampaigns: 20, maxScheduledMessagesPerMonth: 5000, segmentation: true, aiGenerator: false, journeys: true, priorityQueue: false },
  PROFESSIONAL: { maxActiveCampaigns: 9999, maxScheduledMessagesPerMonth: 10000, segmentation: true, aiGenerator: true, journeys: true, priorityQueue: false },
  ENTERPRISE: { maxActiveCampaigns: 9999, maxScheduledMessagesPerMonth: 999999, segmentation: true, aiGenerator: true, journeys: true, priorityQueue: true },
};

export async function getCampaignPlanLimits(businessId: string): Promise<CampaignPlanLimits> {
  const subscription = await prisma.subscription.findUnique({
    where: { businessId },
    select: { plan: true },
  });
  return PLAN_LIMITS[subscription?.plan ?? 'FREE'];
}

export async function assertCampaignCreateAllowed(
  businessId: string,
  recipientCount: number
): Promise<CampaignPlanLimits> {
  const limits = await getCampaignPlanLimits(businessId);

  const activeCount = await prisma.campaign.count({
    where: {
      businessId,
      status: { in: ['DRAFT', 'SCHEDULED', 'RUNNING', 'SENDING', 'PAUSED'] },
      archivedAt: null,
    },
  });
  if (activeCount >= limits.maxActiveCampaigns) {
    throw new ValidationError(
      `Plan limit reached: maximum ${limits.maxActiveCampaigns} active campaigns`
    );
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const sentThisMonth = await prisma.campaignRecipient.count({
    where: {
      campaign: { businessId },
      isSent: true,
      sentAt: { gte: monthStart },
    },
  });
  if (sentThisMonth + recipientCount > limits.maxScheduledMessagesPerMonth) {
    throw new ValidationError(
      `Plan limit reached: ${limits.maxScheduledMessagesPerMonth} scheduled messages per month`
    );
  }

  return limits;
}
