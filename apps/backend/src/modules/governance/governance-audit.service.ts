import { prisma } from '../../infrastructure/database/prisma';
import type { AuditAction, Prisma } from '@prisma/client';

interface GovernanceAuditInput {
  businessId: string;
  userId?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  oldData?: Prisma.InputJsonValue;
  newData?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
  approvalCode?: string;
  approvalStatus?: string;
}

export async function recordGovernanceAudit(input: GovernanceAuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      businessId: input.businessId,
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      oldData: input.oldData,
      newData: {
        ...(typeof input.newData === 'object' && input.newData !== null
          ? (input.newData as Record<string, unknown>)
          : {}),
        ...(input.approvalCode ? { approvalCode: '***' } : {}),
        ...(input.approvalStatus ? { approvalStatus: input.approvalStatus } : {}),
      } as Prisma.InputJsonValue,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  });
}

export function parseDeviceLabel(userAgent?: string): string | undefined {
  if (!userAgent) return undefined;
  if (/mobile/i.test(userAgent)) return 'Mobile';
  if (/tablet/i.test(userAgent)) return 'Tablet';
  if (/windows/i.test(userAgent)) return 'Windows';
  if (/macintosh|mac os/i.test(userAgent)) return 'macOS';
  if (/linux/i.test(userAgent)) return 'Linux';
  return 'Desktop';
}
