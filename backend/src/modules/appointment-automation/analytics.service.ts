import { prisma } from '../../infrastructure/database/prisma';
import { startOfDay } from '../ai-analytics/ai-analytics.repository';

export class AppointmentAnalyticsService {
  async refreshSnapshot(businessId: string) {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [
      created,
      confirmed,
      cancelled,
      completed,
      rescheduled,
      noShows,
      notifications,
      completedWithDuration,
    ] = await Promise.all([
      prisma.appointment.count({ where: { businessId, createdAt: { gte: monthAgo } } }),
      prisma.appointment.count({ where: { businessId, status: 'CONFIRMED' } }),
      prisma.appointment.count({ where: { businessId, status: 'CANCELLED' } }),
      prisma.appointment.count({ where: { businessId, status: 'COMPLETED' } }),
      prisma.appointment.count({ where: { businessId, workflowStageKey: 'RESCHEDULED' } }),
      prisma.appointment.count({
        where: { businessId, status: { in: ['NO_SHOW', 'MISSED'] } },
      }),
      prisma.appointmentNotification.findMany({
        where: { businessId, createdAt: { gte: monthAgo } },
        select: { status: true, channel: true },
      }),
      prisma.appointment.findMany({
        where: { businessId, status: 'COMPLETED', createdAt: { gte: monthAgo } },
        select: { startTime: true, endTime: true, createdAt: true, confirmationSentAt: true },
        take: 500,
      }),
    ]);

    const sent = notifications.filter((n) => n.status === 'SENT').length;
    const emailSent = notifications.filter((n) => n.channel === 'EMAIL' && n.status === 'SENT').length;
    const emailTotal = notifications.filter((n) => n.channel === 'EMAIL').length;
    const waSent = notifications.filter((n) => n.channel === 'WHATSAPP' && n.status === 'SENT').length;
    const waTotal = notifications.filter((n) => n.channel === 'WHATSAPP').length;

    const avgDuration =
      completedWithDuration.length > 0
        ? completedWithDuration.reduce(
            (sum, a) => sum + (a.endTime.getTime() - a.startTime.getTime()) / 60000,
            0
          ) / completedWithDuration.length
        : 0;

    const avgBookingTime =
      completedWithDuration.length > 0
        ? completedWithDuration.reduce(
            (sum, a) => sum + (a.startTime.getTime() - a.createdAt.getTime()) / 60000,
            0
          ) / completedWithDuration.length
        : 0;

    const confirmedWithTime = completedWithDuration.filter((a) => a.confirmationSentAt);
    const avgConfirmation =
      confirmedWithTime.length > 0
        ? confirmedWithTime.reduce(
            (sum, a) => sum + (a.confirmationSentAt!.getTime() - a.createdAt.getTime()) / 60000,
            0
          ) / confirmedWithTime.length
        : 0;

    const total = created || 1;
    const revenue = await prisma.appointment.aggregate({
      where: { businessId, status: 'COMPLETED', createdAt: { gte: monthAgo } },
      _sum: { budget: true },
    });

    const executions = await prisma.appointmentWorkflowExecution.findMany({
      where: { businessId, createdAt: { gte: monthAgo } },
      select: { errors: true },
      take: 500,
    });
    const workflowSuccess =
      executions.length > 0
        ? (executions.filter((e) => !e.errors).length / executions.length) * 100
        : 100;

    return prisma.appointmentAnalyticsSnapshot.upsert({
      where: { businessId },
      create: {
        businessId,
        appointmentsCreated: created,
        appointmentsConfirmed: confirmed,
        appointmentsCancelled: cancelled,
        appointmentsCompleted: completed,
        appointmentsRescheduled: rescheduled,
        noShows,
        avgDurationMinutes: avgDuration,
        avgBookingTimeMinutes: avgBookingTime,
        avgConfirmationMinutes: avgConfirmation,
        reminderSuccessRate: notifications.length ? (sent / notifications.length) * 100 : 0,
        notificationSuccessRate: notifications.length ? (sent / notifications.length) * 100 : 0,
        emailDeliveryRate: emailTotal ? (emailSent / emailTotal) * 100 : 0,
        whatsappDeliveryRate: waTotal ? (waSent / waTotal) * 100 : 0,
        attendanceRate: total ? ((completed + confirmed) / total) * 100 : 0,
        completionRate: total ? (completed / total) * 100 : 0,
        revenueGenerated: revenue._sum.budget ?? 0,
        workflowSuccessRate: workflowSuccess,
        automationSuccessRate: workflowSuccess,
      },
      update: {
        appointmentsCreated: created,
        appointmentsConfirmed: confirmed,
        appointmentsCancelled: cancelled,
        appointmentsCompleted: completed,
        appointmentsRescheduled: rescheduled,
        noShows,
        avgDurationMinutes: avgDuration,
        avgBookingTimeMinutes: avgBookingTime,
        avgConfirmationMinutes: avgConfirmation,
        reminderSuccessRate: notifications.length ? (sent / notifications.length) * 100 : 0,
        notificationSuccessRate: notifications.length ? (sent / notifications.length) * 100 : 0,
        emailDeliveryRate: emailTotal ? (emailSent / emailTotal) * 100 : 0,
        whatsappDeliveryRate: waTotal ? (waSent / waTotal) * 100 : 0,
        attendanceRate: total ? ((completed + confirmed) / total) * 100 : 0,
        completionRate: total ? (completed / total) * 100 : 0,
        revenueGenerated: revenue._sum.budget ?? 0,
        workflowSuccessRate: workflowSuccess,
        automationSuccessRate: workflowSuccess,
      },
    });
  }

  async getDashboard(businessId: string) {
    let snapshot = await prisma.appointmentAnalyticsSnapshot.findUnique({ where: { businessId } });
    if (!snapshot) {
      snapshot = await this.refreshSnapshot(businessId);
    }

    const today = startOfDay();
    const todayCount = await prisma.appointment.count({
      where: { businessId, startTime: { gte: today } },
    });

    const recentExecutions = await prisma.appointmentWorkflowExecution.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { appointment: { select: { title: true, bookingNumber: true } } },
    });

    return { snapshot, todayCount, recentExecutions };
  }
}

export const appointmentAnalyticsService = new AppointmentAnalyticsService();
