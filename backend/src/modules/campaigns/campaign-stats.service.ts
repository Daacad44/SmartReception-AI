import { prisma } from '../../infrastructure/database/prisma';

const SENT_STATUSES = ['SENT', 'DELIVERED', 'READ'] as const;
const DELIVERED_STATUSES = ['DELIVERED', 'READ'] as const;

export type CampaignDeliveryStats = {
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  readCount: number;
};

export async function getCampaignDeliveryStats(
  campaignIds: string[]
): Promise<Map<string, CampaignDeliveryStats>> {
  const stats = new Map<string, CampaignDeliveryStats>();
  if (campaignIds.length === 0) return stats;

  for (const id of campaignIds) {
    stats.set(id, { sentCount: 0, deliveredCount: 0, failedCount: 0, readCount: 0 });
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

  return stats;
}

export function applyCampaignDeliveryStats<T extends { id: string }>(
  campaigns: T[],
  stats: Map<string, CampaignDeliveryStats>
): Array<T & CampaignDeliveryStats> {
  return campaigns.map((campaign) => ({
    ...campaign,
    ...(stats.get(campaign.id) ?? { sentCount: 0, deliveredCount: 0, failedCount: 0, readCount: 0 }),
  }));
}

export async function syncCampaignDeliveryStats(campaignId: string): Promise<CampaignDeliveryStats> {
  const stats = await getCampaignDeliveryStats([campaignId]);
  const counts = stats.get(campaignId) ?? { sentCount: 0, deliveredCount: 0, failedCount: 0, readCount: 0 };

  await prisma.campaign.update({
    where: { id: campaignId },
    data: counts,
  });

  return counts;
}
