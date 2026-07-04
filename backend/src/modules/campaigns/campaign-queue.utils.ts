import { prisma } from '../../infrastructure/database/prisma';
import { getCampaignQueue } from '../../infrastructure/queue/queues';
import { logger } from '../../core/logger';

export async function removeCampaignQueueJobs(campaignId: string): Promise<void> {
  const queue = getCampaignQueue();
  if (!queue) return;

  try {
    const primary = await queue.getJob(campaignId);
    if (primary) await primary.remove();

    const delayed = await queue.getJobs(['delayed', 'waiting']);
    for (const job of delayed) {
      if (job.data?.campaignId === campaignId) {
        await job.remove();
      }
    }
  } catch (error) {
    logger.warn('Failed to remove campaign queue jobs', { campaignId, error });
  }
}

export async function enqueueCampaignSend(
  campaignId: string,
  businessId: string,
  runAt: Date,
  jobId: string
): Promise<void> {
  const queue = getCampaignQueue();
  const delay = runAt.getTime() - Date.now();

  if (queue && delay > 0) {
    await queue.add(
      'campaign-send',
      { campaignId, businessId },
      { delay, jobId, attempts: 1, removeOnComplete: true }
    );
    return;
  }

  if (delay <= 0) {
    const { executeCampaignSend } = await import('./campaigns.service');
    void executeCampaignSend(campaignId, businessId).catch((err) =>
      logger.error('Campaign inline send failed', err)
    );
  }
}
