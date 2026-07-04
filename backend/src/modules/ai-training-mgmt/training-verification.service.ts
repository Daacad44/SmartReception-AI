import type { AiTrainingJobType, AiTrainingOperation, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { otpService } from '../../infrastructure/auth/otp.service';
import { emailService } from '../../infrastructure/email/email.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../../core/errors';
import { recordAiTrainingAudit } from './audit.service';
import { trainingEngineService } from './training-engine.service';
import { logger } from '../../core/logger';

export interface TrainingVerificationInput {
  userId: string;
  email: string;
  firstName: string;
  operation: AiTrainingOperation;
  businessIds: string[];
  jobType?: AiTrainingJobType;
  payload?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

const OPERATION_LABELS: Record<AiTrainingOperation, string> = {
  TRAIN_ONE: 'Train one business',
  RETRAIN_ONE: 'Retrain one business',
  TRAIN_MULTIPLE: 'Train multiple businesses',
  TRAIN_ALL: 'Train all businesses',
  REBUILD_EMBEDDINGS: 'Rebuild embeddings',
  REINDEX: 'Reindex knowledge',
  VALIDATE: 'Validate knowledge',
  OPTIMIZE: 'Optimize knowledge',
  DELETE_OLD_EMBEDDINGS: 'Delete old embeddings',
  GENERATE_EMBEDDINGS: 'Generate new embeddings',
  PREVIEW: 'Preview training',
  ROLLBACK: 'Rollback knowledge version',
  COMPARE_VERSIONS: 'Compare knowledge versions',
};

export class TrainingVerificationService {
  async requestVerification(input: TrainingVerificationInput) {
    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user?.isSuperAdmin) {
      throw new ForbiddenError('Only Super Admins can initiate training operations');
    }

    if (!input.businessIds.length && !['TRAIN_ALL'].includes(input.operation)) {
      throw new ValidationError('At least one business ID is required');
    }

    const code = otpService.generateCode();
    const otpHash = otpService.hashCode(code);
    const otpExpiresAt = otpService.getExpiry();

    const request = await prisma.aiTrainingVerificationRequest.create({
      data: {
        userId: input.userId,
        operation: input.operation,
        jobType: input.jobType,
        businessIds: input.businessIds,
        payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        otpHash,
        otpExpiresAt,
        status: 'PENDING_OTP',
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });

    await emailService.sendOtpEmail(input.email, code, input.firstName, 'verification');

    const primaryBusinessId = input.businessIds[0];
    if (primaryBusinessId) {
      await recordAiTrainingAudit(
        { businessId: primaryBusinessId, userId: input.userId, ipAddress: input.ipAddress, userAgent: input.userAgent },
        'TRAINING_OTP_REQUESTED',
        {
          entity: 'AiTrainingVerificationRequest',
          entityId: request.id,
          newData: { operation: input.operation, businessIds: input.businessIds },
        }
      );
    }

    logger.info('Training OTP requested', {
      requestId: request.id,
      operation: input.operation,
      businessCount: input.businessIds.length,
    });

    return {
      requestId: request.id,
      operation: input.operation,
      operationLabel: OPERATION_LABELS[input.operation],
      businessIds: input.businessIds,
      otpExpiresAt,
      message: 'A 6-digit verification code has been sent to your email. Training is locked until verified.',
    };
  }

  async verifyAndExecute(requestId: string, code: string, userId: string) {
    const request = await prisma.aiTrainingVerificationRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) throw new NotFoundError('Verification request not found');
    if (request.userId !== userId) throw new ForbiddenError('Not authorized');
    if (request.status !== 'PENDING_OTP') {
      throw new ValidationError(`Verification request is ${request.status}`);
    }

    if (otpService.isExpired(request.otpExpiresAt)) {
      await prisma.aiTrainingVerificationRequest.update({
        where: { id: requestId },
        data: { status: 'EXPIRED', failureReason: 'OTP expired' },
      });
      throw new ValidationError('Verification code has expired. Please request a new code.');
    }

    if (request.otpAttempts >= otpService.maxAttempts) {
      await prisma.aiTrainingVerificationRequest.update({
        where: { id: requestId },
        data: { status: 'FAILED', failureReason: 'Too many attempts' },
      });
      throw new ValidationError('Too many failed attempts. Please request a new verification.');
    }

    if (!otpService.verifyCode(code, request.otpHash)) {
      const attempts = request.otpAttempts + 1;
      await prisma.aiTrainingVerificationRequest.update({
        where: { id: requestId },
        data: {
          otpAttempts: attempts,
          status: attempts >= otpService.maxAttempts ? 'FAILED' : 'PENDING_OTP',
          failureReason: attempts >= otpService.maxAttempts ? 'Invalid OTP — max attempts' : undefined,
        },
      });

      const primaryBusinessId = request.businessIds[0];
      if (primaryBusinessId) {
        await recordAiTrainingAudit(
          { businessId: primaryBusinessId, userId },
          'TRAINING_OTP_FAILED',
          { entity: 'AiTrainingVerificationRequest', entityId: requestId }
        );
      }

      throw new ValidationError('Invalid verification code');
    }

    await prisma.aiTrainingVerificationRequest.update({
      where: { id: requestId },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    });

    const primaryBusinessId = request.businessIds[0];
    if (primaryBusinessId) {
      await recordAiTrainingAudit(
        { businessId: primaryBusinessId, userId },
        'TRAINING_OTP_VERIFIED',
        { entity: 'AiTrainingVerificationRequest', entityId: requestId }
      );
    }

    try {
      const result = await trainingEngineService.executeVerifiedOperation({
        operation: request.operation,
        businessIds: request.businessIds,
        jobType: request.jobType ?? undefined,
        payload: (request.payload as Record<string, unknown>) ?? {},
        userId,
      });

      await prisma.aiTrainingVerificationRequest.update({
        where: { id: requestId },
        data: { status: 'EXECUTED', executedAt: new Date() },
      });

      return { verified: true, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Training execution failed';
      await prisma.aiTrainingVerificationRequest.update({
        where: { id: requestId },
        data: { status: 'FAILED', failureReason: message },
      });
      throw error;
    }
  }

  async cancelVerification(requestId: string, userId: string) {
    const request = await prisma.aiTrainingVerificationRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundError('Verification request not found');
    if (request.userId !== userId) throw new ForbiddenError('Not authorized');

    await prisma.aiTrainingVerificationRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' },
    });

    return { cancelled: true };
  }
}

export const trainingVerificationService = new TrainingVerificationService();
