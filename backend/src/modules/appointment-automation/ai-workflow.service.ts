import { prisma } from '../../infrastructure/database/prisma';
import { appointmentTimelineService } from './timeline.service';

export class AppointmentAiWorkflowService {
  async analyzeAppointment(businessId: string, appointmentId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, businessId },
      include: { customer: true, service: true, assignedTo: true },
    });
    if (!appointment) return null;

    const missing: string[] = [];
    if (!appointment.primaryEmail && !appointment.customer.email) missing.push('email');
    if (!appointment.primaryPhone && !appointment.customer.phone) missing.push('phone');
    if (!appointment.serviceId && !appointment.serviceRequested) missing.push('service');
    if (!appointment.assignedToId) missing.push('assigned_employee');
    if (!appointment.location) missing.push('location');

    const conflicts = await prisma.appointment.count({
      where: {
        businessId,
        id: { not: appointmentId },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        OR: [
          {
            startTime: { lt: appointment.endTime },
            endTime: { gt: appointment.startTime },
          },
        ],
      },
    });

    const history = await prisma.appointment.findMany({
      where: { businessId, customerId: appointment.customerId, id: { not: appointmentId } },
      orderBy: { startTime: 'desc' },
      take: 5,
      select: { status: true, startTime: true, serviceRequested: true },
    });

    const noShowCount = history.filter((h) => h.status === 'NO_SHOW' || h.status === 'MISSED').length;
    const noShowProbability = history.length > 0 ? Math.min(95, (noShowCount / history.length) * 100) : 15;

    const insights = {
      missingFields: missing,
      hasSchedulingConflict: conflicts > 0,
      conflictCount: conflicts,
      noShowProbability: Math.round(noShowProbability),
      recommendedReminderFrequency: noShowProbability > 40 ? 'high' : noShowProbability > 20 ? 'medium' : 'standard',
      appointmentHistorySummary: history,
      suggestedFollowUpServices: appointment.service?.name
        ? [`Follow-up ${appointment.service.name}`, 'Maintenance check']
        : ['Follow-up consultation'],
      upsellOpportunities: ['Premium service upgrade', 'Extended session'],
    };

    await appointmentTimelineService.record({
      businessId,
      appointmentId,
      eventType: 'AI_ANALYSIS_COMPLETED',
      actorType: 'AI',
      metadata: insights,
    });

    return insights;
  }

  async suggestBetterTimes(businessId: string, appointmentId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, businessId },
    });
    if (!appointment) return [];

    const dayStart = new Date(appointment.startTime);
    dayStart.setHours(9, 0, 0, 0);
    const suggestions: Array<{ startTime: Date; endTime: Date; score: number }> = [];
    const durationMs = appointment.endTime.getTime() - appointment.startTime.getTime();

    for (let i = 0; i < 5; i++) {
      const start = new Date(dayStart.getTime() + i * 60 * 60 * 1000);
      const end = new Date(start.getTime() + durationMs);
      const conflicts = await prisma.appointment.count({
        where: {
          businessId,
          id: { not: appointmentId },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
          startTime: { lt: end },
          endTime: { gt: start },
        },
      });
      suggestions.push({ startTime: start, endTime: end, score: conflicts === 0 ? 100 - i * 5 : 20 - i });
    }

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 3);
  }
}

export const appointmentAiWorkflowService = new AppointmentAiWorkflowService();
