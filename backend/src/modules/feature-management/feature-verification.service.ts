import type { PlatformFeatureStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { otpService } from '../../infrastructure/auth/otp.service';
import { emailService } from '../../infrastructure/email/email.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../../core/errors';
import { featureRegistryService, isExecutableStatus } from './feature-registry.service';
import { recordFeatureAudit } from './feature-audit.service';
import { parseClientInfo } from './client-info.util';
import { logger } from '../../core/logger';

export interface FeatureVerificationInput {
  userId: string;
  email: string;
  firstName: string;
  featureId: string;
  targetStatus: PlatformFeatureStatus;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

const ACTION_LABELS: Record<string, string> = {
  ENABLE: 'Enable feature',
  DISABLE: 'Disable feature',
  STATUS_CHANGE: 'Change feature status',
  MOVE_FROM_FUTURE: 'Release from Future Features',
};

function resolveVerificationAction(
  previousStatus: PlatformFeatureStatus,
  targetStatus: PlatformFeatureStatus,
  releaseType: string
) {
  if (releaseType === 'FUTURE' && isExecutableStatus(targetStatus)) {
    return 'MOVE_FROM_FUTURE' as const;
  }
  if (isExecutableStatus(targetStatus) && !isExecutableStatus(previousStatus)) {
    return 'ENABLE' as const;
  }
  if (!isExecutableStatus(targetStatus) && isExecutableStatus(previousStatus)) {
    return 'DISABLE' as const;
  }
  return 'STATUS_CHANGE' as const;
}

export class FeatureVerificationService {
  async requestActivation(input: FeatureVerificationInput) {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user?.isSuperAdmin) {
      throw new ForbiddenError('Only Super Admins can activate or deactivate features');
    }

    const feature = await prisma.platformFeature.findUnique({ where: { id: input.featureId } });
    if (!feature) throw new NotFoundError('Feature not found');

    if (feature.featureKey === 'feature-management' && !isExecutableStatus(input.targetStatus)) {
      throw new ValidationError('The Feature Management Center cannot be disabled');
    }

    const dependencyWarnings = await featureRegistryService.getDependencyWarnings(
      feature.id,
      input.targetStatus
    );
    if (dependencyWarnings.length > 0) {
      const names = dependencyWarnings.map((d) => `${d.name} (${d.status})`).join(', ');
      throw new ValidationError(
        `Cannot enable this feature. Required dependencies are not enabled: ${names}`
      );
    }

    const action = resolveVerificationAction(feature.status, input.targetStatus, feature.releaseType);
    const clientInfo = parseClientInfo(input.userAgent);

    const code = otpService.generateCode();
    const otpHash = otpService.hashCode(code);
    const otpExpiresAt = otpService.getExpiry();

    const request = await prisma.platformFeatureVerificationRequest.create({
      data: {
        featureId: feature.id,
        userId: input.userId,
        action,
        targetStatus: input.targetStatus,
        previousStatus: feature.status,
        reason: input.reason,
        otpHash,
        otpExpiresAt,
        status: 'PENDING_OTP',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        browser: clientInfo.browser,
        operatingSystem: clientInfo.operatingSystem,
      },
    });

    await emailService.sendOtpEmail(
      input.email,
      code,
      input.firstName,
      'verification'
    );

    const auditAction =
      action === 'DISABLE' ? 'DEACTIVATION_REQUESTED' : 'ACTIVATION_REQUESTED';

    await recordFeatureAudit(auditAction, {
      featureId: feature.id,
      featureKey: feature.featureKey,
      featureName: feature.name,
      superAdminId: input.userId,
      previousStatus: feature.status,
      newStatus: input.targetStatus,
      verificationStatus: 'PENDING_OTP',
      verificationCodeId: request.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      browser: clientInfo.browser,
      operatingSystem: clientInfo.operatingSystem,
      reason: input.reason,
    });

    logger.info('Feature activation OTP requested', {
      requestId: request.id,
      featureKey: feature.featureKey,
      action,
      targetStatus: input.targetStatus,
    });

    return {
      requestId: request.id,
      featureId: feature.id,
      featureKey: feature.featureKey,
      featureName: feature.name,
      action,
      actionLabel: ACTION_LABELS[action] ?? action,
      previousStatus: feature.status,
      targetStatus: input.targetStatus,
      otpExpiresAt,
      message: 'A 6-digit verification code has been sent to your Super Admin email.',
    };
  }

  async verifyAndApply(requestId: string, code: string, userId: string) {
    const request = await prisma.platformFeatureVerificationRequest.findUnique({
      where: { id: requestId },
      include: { feature: true },
    });

    if (!request) throw new NotFoundError('Verification request not found');
    if (request.userId !== userId) throw new ForbiddenError('Not authorized');
    if (request.status !== 'PENDING_OTP') {
      throw new ValidationError(`Verification request is ${request.status}`);
    }

    const clientInfo = parseClientInfo(request.userAgent ?? undefined);

    if (otpService.isExpired(request.otpExpiresAt)) {
      await prisma.platformFeatureVerificationRequest.update({
        where: { id: requestId },
        data: { status: 'EXPIRED', failureReason: 'OTP expired' },
      });
      await recordFeatureAudit('ACTIVATION_FAILED', {
        featureId: request.featureId,
        featureKey: request.feature.featureKey,
        featureName: request.feature.name,
        superAdminId: userId,
        previousStatus: request.previousStatus,
        newStatus: request.targetStatus,
        verificationStatus: 'EXPIRED',
        verificationCodeId: requestId,
        ipAddress: request.ipAddress ?? undefined,
        userAgent: request.userAgent ?? undefined,
        browser: clientInfo.browser,
        operatingSystem: clientInfo.operatingSystem,
        reason: 'OTP expired',
      });
      throw new ValidationError('Verification code has expired. Please request a new code.');
    }

    if (request.otpAttempts >= otpService.maxAttempts) {
      await prisma.platformFeatureVerificationRequest.update({
        where: { id: requestId },
        data: { status: 'FAILED', failureReason: 'Too many attempts' },
      });
      throw new ValidationError('Too many failed attempts. Please request a new verification.');
    }

    if (!otpService.verifyCode(code, request.otpHash)) {
      const attempts = request.otpAttempts + 1;
      await prisma.platformFeatureVerificationRequest.update({
        where: { id: requestId },
        data: {
          otpAttempts: attempts,
          status: attempts >= otpService.maxAttempts ? 'FAILED' : 'PENDING_OTP',
          failureReason: attempts >= otpService.maxAttempts ? 'Invalid OTP — max attempts' : undefined,
        },
      });

      await recordFeatureAudit('ACTIVATION_FAILED', {
        featureId: request.featureId,
        featureKey: request.feature.featureKey,
        featureName: request.feature.name,
        superAdminId: userId,
        previousStatus: request.previousStatus,
        newStatus: request.targetStatus,
        verificationStatus: 'INVALID_OTP',
        verificationCodeId: requestId,
        ipAddress: request.ipAddress ?? undefined,
        userAgent: request.userAgent ?? undefined,
        browser: clientInfo.browser,
        operatingSystem: clientInfo.operatingSystem,
      });

      throw new ValidationError('Invalid verification code');
    }

    const dependencyWarnings = await featureRegistryService.getDependencyWarnings(
      request.featureId,
      request.targetStatus
    );
    if (dependencyWarnings.length > 0) {
      const names = dependencyWarnings.map((d) => d.name).join(', ');
      throw new ValidationError(`Dependencies no longer satisfied: ${names}`);
    }

    await prisma.platformFeatureVerificationRequest.update({
      where: { id: requestId },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    });

    const now = new Date();
    const updateData: {
      status: PlatformFeatureStatus;
      lastModifiedById: string;
      activationDate?: Date;
      deactivationDate?: Date;
      releaseType?: 'STANDARD';
    } = {
      status: request.targetStatus,
      lastModifiedById: userId,
    };

    if (isExecutableStatus(request.targetStatus)) {
      updateData.activationDate = now;
      updateData.deactivationDate = undefined;
      if (request.feature.releaseType === 'FUTURE') {
        updateData.releaseType = 'STANDARD';
      }
    } else {
      updateData.deactivationDate = now;
    }

    const updated = await prisma.platformFeature.update({
      where: { id: request.featureId },
      data: updateData,
    });

    featureRegistryService.invalidateCache(updated.featureKey);

    await prisma.platformFeatureVerificationRequest.update({
      where: { id: requestId },
      data: { status: 'EXECUTED', executedAt: now },
    });

    const auditAction = request.action === 'DISABLE' ? 'DEACTIVATION_VERIFIED' : 'ACTIVATION_VERIFIED';
    await recordFeatureAudit(auditAction, {
      featureId: updated.id,
      featureKey: updated.featureKey,
      featureName: updated.name,
      superAdminId: userId,
      previousStatus: request.previousStatus,
      newStatus: request.targetStatus,
      verificationStatus: 'VERIFIED',
      verificationCodeId: requestId,
      ipAddress: request.ipAddress ?? undefined,
      userAgent: request.userAgent ?? undefined,
      browser: clientInfo.browser,
      operatingSystem: clientInfo.operatingSystem,
      reason: request.reason ?? undefined,
    });

    if (request.action === 'MOVE_FROM_FUTURE') {
      await recordFeatureAudit('MOVED_FROM_FUTURE', {
        featureId: updated.id,
        featureKey: updated.featureKey,
        featureName: updated.name,
        superAdminId: userId,
        previousStatus: request.previousStatus,
        newStatus: request.targetStatus,
        verificationCodeId: requestId,
        reason: request.reason ?? undefined,
      });
    }

    return {
      verified: true,
      feature: updated,
      previousStatus: request.previousStatus,
      newStatus: request.targetStatus,
    };
  }

  async cancelVerification(requestId: string, userId: string) {
    const request = await prisma.platformFeatureVerificationRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundError('Verification request not found');
    if (request.userId !== userId) throw new ForbiddenError('Not authorized');

    await prisma.platformFeatureVerificationRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' },
    });

    return { cancelled: true };
  }
}

export const featureVerificationService = new FeatureVerificationService();
