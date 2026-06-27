import type {
  BusinessLicenseStatus,
  SubscriptionActivityAction,
  SubscriptionDurationPreset,
  SubscriptionPlan,
} from '@prisma/client';

export const REMINDER_OFFSETS_MS: Record<string, number> = {
  REMINDER_7D: 7 * 24 * 60 * 60 * 1000,
  REMINDER_3D: 3 * 24 * 60 * 60 * 1000,
  REMINDER_2D: 2 * 24 * 60 * 60 * 1000,
  REMINDER_1D: 24 * 60 * 60 * 1000,
  REMINDER_12H: 12 * 60 * 60 * 1000,
  REMINDER_6H: 6 * 60 * 60 * 1000,
  REMINDER_1H: 60 * 60 * 1000,
};

export const DURATION_PRESET_DAYS: Record<SubscriptionDurationPreset, number> = {
  DAYS_30: 30,
  DAYS_90: 90,
  DAYS_180: 180,
  DAYS_365: 365,
  CUSTOM: 0,
};

export const LOCKED_LICENSE_STATUSES: BusinessLicenseStatus[] = [
  'EXPIRED',
  'SUSPENDED',
  'CANCELLED',
  'PENDING',
];

export const ACTIVE_LICENSE_STATUSES: BusinessLicenseStatus[] = ['ACTIVE', 'TRIAL'];

export interface AssignSubscriptionInput {
  businessId: string;
  planCode: SubscriptionPlan;
  durationPreset: SubscriptionDurationPreset;
  customDurationDays?: number;
  activationDate?: Date;
  internalNotes?: string;
  paymentStatus?: 'NOT_APPLICABLE' | 'PENDING' | 'PAID';
}

export interface ExtendSubscriptionInput {
  businessId: string;
  additionalDays: number;
  reason?: string;
}

export interface ChangePlanInput {
  businessId: string;
  planCode: SubscriptionPlan;
  reason?: string;
}

export interface SubscriptionActorContext {
  userId: string;
  email: string;
  ipAddress?: string;
}

export interface LicenseValidationResult {
  valid: boolean;
  status: BusinessLicenseStatus;
  expiresAt: Date | null;
  isLocked: boolean;
  reason?: string;
}

export type SubscriptionAdminAction =
  | 'assign'
  | 'extend'
  | 'shorten'
  | 'pause'
  | 'resume'
  | 'suspend'
  | 'reactivate'
  | 'cancel'
  | 'upgrade'
  | 'downgrade'
  | 'unlock'
  | 'add-note';

export const SUBSCRIPTION_ACTIVITY_MAP: Record<SubscriptionAdminAction, SubscriptionActivityAction> = {
  assign: 'ASSIGNED',
  extend: 'EXTENDED',
  shorten: 'SHORTENED',
  pause: 'PAUSED',
  resume: 'RESUMED',
  suspend: 'SUSPENDED',
  reactivate: 'REACTIVATED',
  cancel: 'CANCELLED',
  upgrade: 'UPGRADED',
  downgrade: 'DOWNGRADED',
  unlock: 'UNLOCKED',
  'add-note': 'NOTE_ADDED',
};
