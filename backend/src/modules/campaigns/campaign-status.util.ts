const UNCHANGED_STATUSES = new Set(['CANCELLED', 'ARCHIVED']);

/**
 * After a delivery webhook settles, flip COMPLETED (or any non-terminal status)
 * to FAILED when every recipient failed and none succeeded. A FAILED campaign
 * that later has successes (retry) is reclassified as COMPLETED.
 */
export function nextCampaignStatusAfterWebhook(input: {
  currentStatus: string;
  pendingCount: number;
  sentCount: number;
  failedCount: number;
}): 'FAILED' | 'COMPLETED' | null {
  if (input.pendingCount > 0) return null;
  if (UNCHANGED_STATUSES.has(input.currentStatus)) return null;
  if (input.failedCount > 0 && input.sentCount === 0 && input.currentStatus !== 'FAILED') {
    return 'FAILED';
  }
  if (input.currentStatus === 'FAILED' && input.sentCount > 0) {
    return 'COMPLETED';
  }
  return null;
}
