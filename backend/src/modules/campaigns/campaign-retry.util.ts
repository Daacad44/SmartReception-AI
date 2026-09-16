export const MAX_CAMPAIGN_RETRIES = 3;
export const CAMPAIGN_RETRY_COOLDOWN_MS = 5 * 60 * 1000;

const BLOCKED_RETRY_STATUSES = new Set(['RUNNING', 'SENDING', 'ARCHIVED', 'CANCELLED']);

/** Permanent Graph / policy failures that must not be retried. 131047 (session) is retryable. */
export function isPermanentCampaignFailure(reason: string | null | undefined): boolean {
  if (!reason) return false;
  if (/\b131047\b/.test(reason)) return false;

  const text = reason.toLowerCase();
  if (/\b131026\b/.test(reason)) return true;
  if (/opted?\s*out/.test(text)) return true;
  if (/\bblocked\b/.test(text)) return true;
  if (/\binvalid\b/.test(text) && /(number|phone|recipient|user)/.test(text)) return true;
  return false;
}

export function isRetryableFailedRecipient(input: {
  status: string;
  phone: string | null | undefined;
  failedReason: string | null | undefined;
  optedOut: boolean;
}): boolean {
  if (input.status !== 'FAILED') return false;
  if (input.optedOut) return false;
  const digits = (input.phone ?? '').replace(/\D/g, '');
  if (!digits) return false;
  if (isPermanentCampaignFailure(input.failedReason)) return false;
  return true;
}

export function getCampaignRetryBlockReason(input: {
  status: string;
  retryCount: number;
  lastRetryAt: Date | null | undefined;
  now?: Date;
}): string | null {
  if (BLOCKED_RETRY_STATUSES.has(input.status)) {
    return `Cannot retry a ${input.status.toLowerCase()} campaign`;
  }
  if (input.retryCount >= MAX_CAMPAIGN_RETRIES) {
    return `Maximum of ${MAX_CAMPAIGN_RETRIES} retries reached`;
  }
  if (input.lastRetryAt) {
    const elapsed = (input.now ?? new Date()).getTime() - input.lastRetryAt.getTime();
    if (elapsed < CAMPAIGN_RETRY_COOLDOWN_MS) {
      const waitMin = Math.max(1, Math.ceil((CAMPAIGN_RETRY_COOLDOWN_MS - elapsed) / 60_000));
      return `Please wait ${waitMin} minute(s) before retrying again`;
    }
  }
  return null;
}

/** True when some recipients belong to an earlier run (retry of failures only). */
export function isPartialCampaignRetry(campaignRunVersion: number, recipientRunVersions: number[]): boolean {
  return recipientRunVersions.some((version) => version !== campaignRunVersion);
}
