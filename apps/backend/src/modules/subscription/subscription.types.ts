import type {
  BusinessLicenseStatus,
  SubscriptionActivityAction,
  SubscriptionDurationPreset,
  SubscriptionPaymentMethod,
  SubscriptionPaymentStatus,
  SubscriptionPlan,
} from '@prisma/client';

export const REMINDER_OFFSETS_MS: Record<string, number> = {
  REMINDER_7D: 7 * 24 * 60 * 60 * 1000,
  REMINDER_5D: 5 * 24 * 60 * 60 * 1000,
  REMINDER_3D: 3 * 24 * 60 * 60 * 1000,
  REMINDER_2D: 2 * 24 * 60 * 60 * 1000,
  REMINDER_1D: 24 * 60 * 60 * 1000,
  REMINDER_12H: 12 * 60 * 60 * 1000,
  REMINDER_6H: 6 * 60 * 60 * 1000,
  REMINDER_1H: 60 * 60 * 1000,
};

export const DURATION_PRESET_DAYS: Record<SubscriptionDurationPreset, number> = {
  DAYS_7: 7,
  DAYS_14: 14,
  DAYS_30: 30,
  DAYS_60: 60,
  DAYS_90: 90,
  DAYS_180: 180,
  DAYS_365: 365,
  CUSTOM: 0,
};

export const EXTEND_PRESET_DAYS = [7, 14, 30, 60, 90, 180, 365] as const;

export const LOCKED_LICENSE_STATUSES: BusinessLicenseStatus[] = [
  'EXPIRED',
  'SUSPENDED',
  'CANCELLED',
  'PENDING',
  'LOCKED',
];

export const ACTIVE_LICENSE_STATUSES: BusinessLicenseStatus[] = ['ACTIVE', 'TRIAL'];

export interface PlanFeatureFlags {
  aiChat: boolean;
  knowledgeBase: boolean;
  appointments: boolean;
  broadcast: boolean;
  crm: boolean;
  campaigns: boolean;
  analytics: boolean;
  apiAccess: boolean;
  webhookAccess: boolean;
  multiBusiness: boolean;
  whiteLabel: boolean;
  aiTrainingManage: boolean;
  whatsappSelfService: boolean;
}

export const DEFAULT_FEATURE_FLAGS: PlanFeatureFlags = {
  aiChat: true,
  knowledgeBase: false,
  appointments: true,
  broadcast: false,
  crm: true,
  campaigns: false,
  analytics: false,
  apiAccess: false,
  webhookAccess: false,
  multiBusiness: false,
  whiteLabel: false,
  aiTrainingManage: false,
  whatsappSelfService: false,
};

export interface AssignSubscriptionInput {
  businessId: string;
  planCode: SubscriptionPlan;
  durationPreset: SubscriptionDurationPreset;
  customDurationDays?: number;
  activationDate?: Date;
  endDate?: Date;
  isTrial?: boolean;
  internalNotes?: string;
  paymentStatus?: SubscriptionPaymentStatus;
  paymentMethod?: SubscriptionPaymentMethod;
  referenceNumber?: string;
  invoiceNumber?: string;
  amount?: number;
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

export interface SubscriptionCalculation {
  startDate: Date;
  endDate: Date;
  durationDays: number;
  remainingDays: number;
  status: BusinessLicenseStatus;
}

export function calculateSubscriptionDates(params: {
  startDate: Date;
  durationPreset: SubscriptionDurationPreset;
  customDurationDays?: number;
  endDate?: Date;
  isTrial?: boolean;
}): SubscriptionCalculation {
  const startDate = new Date(params.startDate);
  startDate.setHours(0, 0, 0, 0);

  let durationDays: number;
  let endDate: Date;

  if (params.endDate) {
    endDate = new Date(params.endDate);
    endDate.setHours(23, 59, 59, 999);
    durationDays = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );
  } else {
    durationDays =
      params.durationPreset === 'CUSTOM'
        ? Math.max(1, params.customDurationDays ?? 1)
        : DURATION_PRESET_DAYS[params.durationPreset];
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);
    endDate.setHours(23, 59, 59, 999);
  }

  const now = Date.now();
  const remainingDays = Math.max(
    0,
    Math.ceil((endDate.getTime() - now) / (1000 * 60 * 60 * 24))
  );

  const status: BusinessLicenseStatus = params.isTrial ? 'TRIAL' : 'ACTIVE';

  return { startDate, endDate, durationDays, remainingDays, status };
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
  | 'lock'
  | 'add-note'
  | 'edit';

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
  lock: 'LOCKED',
  'add-note': 'NOTE_ADDED',
  edit: 'EDITED',
};
