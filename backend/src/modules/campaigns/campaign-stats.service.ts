import { prisma } from '../../infrastructure/database/prisma';
import { nextCampaignStatusAfterWebhook } from './campaign-status.util';

const SENT_STATUSES = ['SENT', 'DELIVERED', 'READ'] as const;
const DELIVERED_STATUSES = ['DELIVERED', 'READ'] as const;

export type CampaignDeliveryStats = {
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  readCount: number;
  failedReason: string | null;
};

function emptyStats(): CampaignDeliveryStats {
  return { sentCount: 0, deliveredCount: 0, failedCount: 0, readCount: 0, failedReason: null };
}

export async function getCampaignDeliveryStats(
  campaignIds: string[]
): Promise<Map<string, CampaignDeliveryStats>> {
  const stats = new Map<string, CampaignDeliveryStats>();
  if (campaignIds.length === 0) return stats;

  for (const id of campaignIds) {
    stats.set(id, emptyStats());
  }

  const rows = await prisma.campaignRecipient.groupBy({
    by: ['campaignId', 'status'],
    where: { campaignId: { in: campaignIds } },
    _count: { status: true },
  });

  for (const row of rows) {
    const entry = stats.get(row.campaignId);
    if (!entry) continue;
    const count = row._count.status;
    if ((SENT_STATUSES as readonly string[]).includes(row.status)) entry.sentCount += count;
    if ((DELIVERED_STATUSES as readonly string[]).includes(row.status)) entry.deliveredCount += count;
    if (row.status === 'READ') entry.readCount += count;
    if (row.status === 'FAILED') entry.failedCount += count;
  }

  const failedCampaignIds = [...stats.entries()]
    .filter(([, entry]) => entry.failedCount > 0)
    .map(([id]) => id);

  if (failedCampaignIds.length > 0) {
    const failedRows = await prisma.campaignRecipient.findMany({
      where: {
        campaignId: { in: failedCampaignIds },
        status: 'FAILED',
        failedReason: { not: null },
      },
      select: { campaignId: true, failedReason: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    for (const row of failedRows) {
      const entry = stats.get(row.campaignId);
      if (entry && !entry.failedReason) {
        entry.failedReason = row.failedReason;
      }
    }
  }

  return stats;
}

export function applyCampaignDeliveryStats<T extends { id: string }>(
  campaigns: T[],
  stats: Map<string, CampaignDeliveryStats>
): Array<T & CampaignDeliveryStats> {
  return campaigns.map((campaign) => ({
    ...campaign,
    ...(stats.get(campaign.id) ?? emptyStats()),
  }));
}

export async function syncCampaignDeliveryStats(campaignId: string): Promise<CampaignDeliveryStats> {
  const stats = await getCampaignDeliveryStats([campaignId]);
  const counts = stats.get(campaignId) ?? emptyStats();

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      sentCount: counts.sentCount,
      deliveredCount: counts.deliveredCount,
      failedCount: counts.failedCount,
      readCount: counts.readCount,
    },
  });

  return counts;
}

/** Recount live recipient stats and flip the campaign to FAILED when nothing succeeded. */
export async function syncCampaignDeliveryStatsAndStatus(
  campaignId: string
): Promise<CampaignDeliveryStats> {
  const counts = await syncCampaignDeliveryStats(campaignId);

  const [pending, campaign] = await Promise.all([
    prisma.campaignRecipient.count({
      where: { campaignId, isSent: false, status: { in: ['PENDING', 'SENDING'] } },
    }),
    prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    }),
  ]);

  if (!campaign) return counts;

  const nextStatus = nextCampaignStatusAfterWebhook({
    currentStatus: campaign.status,
    pendingCount: pending,
    sentCount: counts.sentCount,
    failedCount: counts.failedCount,
  });

  if (nextStatus) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: nextStatus },
    });
  }

  return counts;
}
