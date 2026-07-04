import { getEmployeeBroadcastQueue } from '../../infrastructure/queue/queues';
import { logger } from '../../core/logger';

export async function removeEmployeeBroadcastQueueJobs(broadcastId: string): Promise<void> {
  const queue = getEmployeeBroadcastQueue();
  if (!queue) return;
  try {
    const primary = await queue.getJob(broadcastId);
    if (primary) await primary.remove();
    const jobs = await queue.getJobs(['delayed', 'waiting']);
    for (const job of jobs) {
      if (job.data?.broadcastId === broadcastId) await job.remove();
    }
  } catch (error) {
    logger.warn('Failed to remove employee broadcast queue jobs', { broadcastId, error });
  }
}

export async function enqueueEmployeeBroadcastSend(
  broadcastId: string,
  businessId: string,
  runAt: Date,
  jobId: string
): Promise<void> {
  const queue = getEmployeeBroadcastQueue();
  const delay = runAt.getTime() - Date.now();

  if (queue && delay > 0) {
    await queue.add(
      'employee-broadcast-send',
      { broadcastId, businessId },
      { delay, jobId, attempts: 1, removeOnComplete: true }
    );
    return;
  }

  if (delay <= 0) {
    const { executeEmployeeBroadcastSend } = await import('./employee-broadcasts.service');
    void executeEmployeeBroadcastSend(broadcastId, businessId).catch((err) =>
      logger.error('Employee broadcast inline send failed', err)
    );
  }
}
