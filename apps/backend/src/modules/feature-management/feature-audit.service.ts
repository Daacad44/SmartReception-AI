import type {
  PlatformFeatureAuditAction,
  PlatformFeatureStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';

export interface FeatureAuditContext {
  featureId: string;
  featureKey: string;
  featureName: string;
  superAdminId?: string;
  businessId?: string;
  previousStatus?: PlatformFeatureStatus;
  newStatus?: PlatformFeatureStatus;
  verificationStatus?: string;
  verificationCodeId?: string;
  ipAddress?: string;
  userAgent?: string;
  browser?: string;
  operatingSystem?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export async function recordFeatureAudit(
  action: PlatformFeatureAuditAction,
  context: FeatureAuditContext
) {
  return prisma.platformFeatureAuditLog.create({
    data: {
      featureId: context.featureId,
      featureKey: context.featureKey,
      featureName: context.featureName,
      businessId: context.businessId,
      action,
      previousStatus: context.previousStatus,
      newStatus: context.newStatus,
      superAdminId: context.superAdminId,
      verificationStatus: context.verificationStatus,
      verificationCodeId: context.verificationCodeId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      browser: context.browser,
      operatingSystem: context.operatingSystem,
      reason: context.reason,
      metadata: context.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
