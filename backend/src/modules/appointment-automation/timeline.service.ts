import type { AppointmentTimelineActorType } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';

export class AppointmentTimelineService {
  async record(input: {
    businessId: string;
    appointmentId: string;
    eventType: string;
    actorType?: AppointmentTimelineActorType;
    actorId?: string;
    customerId?: string;
    employeeId?: string;
    channel?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.appointmentTimelineEvent.create({
      data: {
        businessId: input.businessId,
        appointmentId: input.appointmentId,
        eventType: input.eventType,
        actorType: input.actorType ?? 'SYSTEM',
        actorId: input.actorId,
        customerId: input.customerId,
        employeeId: input.employeeId,
        channel: input.channel,
        status: input.status,
        metadata: (input.metadata ?? undefined) as import('@prisma/client').Prisma.InputJsonValue | undefined,
      },
    });
  }

  async listForAppointment(businessId: string, appointmentId: string, limit = 100) {
    return prisma.appointmentTimelineEvent.findMany({
      where: { businessId, appointmentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

export const appointmentTimelineService = new AppointmentTimelineService();
