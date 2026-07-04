import type { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import type { WorkflowAction } from './types';

export class AppointmentWorkflowAuditService {
  async recordExecution(input: {
    businessId: string;
    workflowId: string;
    appointmentId: string;
    triggerEvent: string;
    executedActions: WorkflowAction[];
    notificationStatus?: Record<string, unknown>;
    deliveryStatus?: Record<string, unknown>;
    executionTimeMs?: number;
    errors?: unknown[];
    warnings?: unknown[];
    operatorId?: string;
    ipAddress?: string;
    device?: string;
    retryCount?: number;
  }) {
    return prisma.appointmentWorkflowExecution.create({
      data: {
        businessId: input.businessId,
        workflowId: input.workflowId,
        appointmentId: input.appointmentId,
        triggerEvent: input.triggerEvent,
        executedActions: input.executedActions as unknown as Prisma.InputJsonValue,
        notificationStatus: input.notificationStatus as Prisma.InputJsonValue | undefined,
        deliveryStatus: input.deliveryStatus as Prisma.InputJsonValue | undefined,
        executionTimeMs: input.executionTimeMs,
        errors: input.errors?.length ? (input.errors as unknown as Prisma.InputJsonValue) : undefined,
        warnings: input.warnings?.length ? (input.warnings as unknown as Prisma.InputJsonValue) : undefined,
        operatorId: input.operatorId,
        ipAddress: input.ipAddress,
        device: input.device,
        retryCount: input.retryCount ?? 0,
      },
    });
  }

  async listForAppointment(businessId: string, appointmentId: string, limit = 50) {
    return prisma.appointmentWorkflowExecution.findMany({
      where: { businessId, appointmentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listForBusiness(businessId: string, limit = 100) {
    return prisma.appointmentWorkflowExecution.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        appointment: { select: { id: true, title: true, bookingNumber: true } },
      },
    });
  }
}

export const appointmentWorkflowAuditService = new AppointmentWorkflowAuditService();
