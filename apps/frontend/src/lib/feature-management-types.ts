export type PlatformFeatureStatus =
  | 'DISABLED'
  | 'ENABLED'
  | 'HIDDEN'
  | 'INTERNAL'
  | 'BETA'
  | 'COMING_SOON'
  | 'EXPERIMENTAL'
  | 'DEPRECATED'
  | 'ARCHIVED';

export interface PlatformFeatureDependency {
  dependsOnFeature: {
    featureKey: string;
    name: string;
    status: PlatformFeatureStatus;
  };
}

export interface PlatformFeature {
  id: string;
  featureKey: string;
  name: string;
  description: string;
  category: string;
  version: string;
  module: string;
  status: PlatformFeatureStatus;
  visibility: string;
  releaseType: string;
  scope: string;
  routePath?: string | null;
  apiPrefix?: string | null;
  navLabel?: string | null;
  isNavItem: boolean;
  blocksAi: boolean;
  blocksJobs: boolean;
  notes?: string | null;
  activationDate?: string | null;
  deactivationDate?: string | null;
  createdAt: string;
  updatedAt: string;
  dependencies?: PlatformFeatureDependency[];
  _count?: { auditLogs: number };
}

export interface FeaturePublicMapEntry {
  enabled: boolean;
  status: PlatformFeatureStatus;
}

export type FeaturePublicMap = Record<string, FeaturePublicMapEntry>;

export interface FeatureVerificationRequest {
  requestId: string;
  featureId: string;
  featureKey: string;
  featureName: string;
  action: string;
  actionLabel: string;
  previousStatus: PlatformFeatureStatus;
  targetStatus: PlatformFeatureStatus;
  otpExpiresAt: string;
  message: string;
}

export interface FeatureManagementStats {
  total: number;
  enabled: number;
  disabled: number;
  future: number;
}

export interface FeatureAuditLog {
  id: string;
  featureKey: string;
  featureName: string;
  action: string;
  previousStatus?: PlatformFeatureStatus | null;
  newStatus?: PlatformFeatureStatus | null;
  verificationStatus?: string | null;
  reason?: string | null;
  ipAddress?: string | null;
  browser?: string | null;
  operatingSystem?: string | null;
  createdAt: string;
  superAdmin?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
}
