import type { BusinessLicenseStatus } from '@prisma/client';
import { subscriptionRepository } from './subscription.repository';
import {
  ACTIVE_LICENSE_STATUSES,
  LOCKED_LICENSE_STATUSES,
  type LicenseValidationResult,
} from './subscription.types';

export function isLicenseStatusLocked(status: BusinessLicenseStatus): boolean {
  return LOCKED_LICENSE_STATUSES.includes(status);
}

export function computeRemainingMs(expiresAt: Date | null | undefined): number | null {
  if (!expiresAt) return null;
  return expiresAt.getTime() - Date.now();
}

export function formatRemainingTime(expiresAt: Date | null | undefined): string {
  const ms = computeRemainingMs(expiresAt);
  if (ms === null) return 'No expiration set';
  if (ms <= 0) return 'Expired';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days >= 1) return `${days} day${days === 1 ? '' : 's'}`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const minutes = Math.max(1, Math.floor(ms / (1000 * 60)));
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export async function validateBusinessLicense(businessId: string): Promise<LicenseValidationResult> {
  const business = await subscriptionRepository.getBusinessLicense(businessId);
  if (!business) {
    return { valid: false, status: 'PENDING', expiresAt: null, isLocked: true, reason: 'Business not found' };
  }

  const sub = business.businessSubscription;
  const status = business.licenseStatus;
  const expiresAt = sub?.expiresAt ?? null;
  const now = new Date();

  if (!business.isActive) {
    return { valid: false, status: 'SUSPENDED', expiresAt, isLocked: true, reason: 'Business suspended' };
  }

  if (business.isLicenseLocked || isLicenseStatusLocked(status)) {
    return {
      valid: false,
      status,
      expiresAt,
      isLocked: true,
      reason: `Subscription ${status.toLowerCase()}`,
    };
  }

  if (sub?.isPaused) {
    return { valid: false, status: 'SUSPENDED', expiresAt, isLocked: true, reason: 'Subscription paused' };
  }

  if (expiresAt && expiresAt <= now && ACTIVE_LICENSE_STATUSES.includes(status)) {
    return { valid: false, status: 'EXPIRED', expiresAt, isLocked: true, reason: 'Subscription expired' };
  }

  if (!ACTIVE_LICENSE_STATUSES.includes(status)) {
    return { valid: false, status, expiresAt, isLocked: true, reason: `Subscription ${status.toLowerCase()}` };
  }

  return { valid: true, status, expiresAt, isLocked: false };
}

export async function assertValidLicense(businessId: string): Promise<void> {
  const result = await validateBusinessLicense(businessId);
  if (!result.valid) {
    const { SubscriptionExpiredError } = await import('../../core/errors');
    throw new SubscriptionExpiredError(result.reason ?? 'Subscription expired');
  }
}

export async function isWhatsAppAutomationAllowed(businessId: string): Promise<boolean> {
  const result = await validateBusinessLicense(businessId);
  return result.valid;
}
