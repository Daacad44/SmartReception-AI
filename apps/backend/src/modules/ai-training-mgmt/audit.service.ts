import type { Prisma, AiTrainingAuditAction } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';

export interface AuditContext {
  businessId: string;
  versionId?: string;
  trainerId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceLabel?: string;
}

export async function recordAiTrainingAudit(
  ctx: AuditContext,
  action: AiTrainingAuditAction,
  details?: {
    entity?: string;
    entityId?: string;
    oldData?: Record<string, unknown>;
    newData?: Record<string, unknown>;
  }
): Promise<void> {
  await prisma.aiTrainingAuditLog.create({
    data: {
      businessId: ctx.businessId,
      versionId: ctx.versionId,
      trainerId: ctx.trainerId,
      userId: ctx.userId,
      action,
      entity: details?.entity,
      entityId: details?.entityId,
      oldData: details?.oldData as Prisma.InputJsonValue | undefined,
      newData: details?.newData as Prisma.InputJsonValue | undefined,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      deviceLabel: ctx.deviceLabel,
    },
  });
}

export function parseDeviceLabel(userAgent?: string): string | undefined {
  if (!userAgent) return undefined;
  if (/mobile/i.test(userAgent)) return 'Mobile';
  if (/tablet/i.test(userAgent)) return 'Tablet';
  return 'Desktop';
}
