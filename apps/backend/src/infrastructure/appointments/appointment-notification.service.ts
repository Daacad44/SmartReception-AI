import { prisma } from '../database/prisma';
import { logger } from '../../core/logger';
import {
  dispatchAppointmentNotification,
  reminderLabelToNotificationType,
} from './appointment-notification-engine.service';
import {
  cancelAppointmentReminderJobs,
  scheduleMissedFollowUp,
} from './appointment-scheduler.service';
import {
  cancelConfigurableReminders,
  scheduleConfigurableReminders,
} from '../../modules/appointment-automation/reminder-scheduler.service';

export type ReminderInterval = '30m' | '20m' | '10m' | 'missed' | 'followup-24h' | 'configurable';

export async function sendAppointmentConfirmation(
  appointmentId: string,
  businessId: string
): Promise<void> {
  await dispatchAppointmentNotification({
    appointmentId,
    businessId,
    notificationType: 'APPOINTMENT_CREATED',
    templateKey: 'confirmation',
    attachIcs: true,
  });

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { confirmationSentAt: new Date() },
  });
}

export async function sendAppointmentApproved(
  appointmentId: string,
  businessId: string
): Promise<void> {
  await dispatchAppointmentNotification({
    appointmentId,
    businessId,
    notificationType: 'APPOINTMENT_CONFIRMED',
    templateKey: 'confirmed',
    attachIcs: true,
  });

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { confirmationSentAt: new Date(), status: 'CONFIRMED' },
  });
}

export async function sendAppointmentReminder(
  appointmentId: string,
  businessId: string,
  interval: '30m' | '20m' | '10m'
): Promise<void> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId },
  });
  if (!appointment) return;
  if (['CANCELLED', 'COMPLETED', 'MISSED', 'NO_SHOW', 'EXPIRED', 'ARCHIVED'].includes(appointment.status)) {
    return;
  }

  const flagKey =
    interval === '30m' ? 'reminder30mSent' : interval === '20m' ? 'reminder20mSent' : 'reminder10mSent';
  if (appointment[flagKey as keyof typeof appointment]) return;

  const typeMap = {
    '30m': 'REMINDER_30_MIN' as const,
    '20m': 'REMINDER_20_MIN' as const,
    '10m': 'REMINDER_10_MIN' as const,
  };
  const labelMap = { '30m': '30 Minutes Before', '20m': '20 Minutes Before', '10m': '10 Minutes Before' };

  await dispatchAppointmentNotification({
    appointmentId,
    businessId,
    notificationType: typeMap[interval],
    templateKey: 'reminder',
    extras: { reminderLabel: labelMap[interval] },
    scheduledAt: appointment.startTime,
  });

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { [flagKey]: true, reminderSent: true },
  });

  logger.info('Appointment reminder sent', { appointmentId, interval });
}

export async function sendConfigurableReminder(
  appointmentId: string,
  businessId: string,
  label: string,
  channels?: Array<'EMAIL' | 'WHATSAPP'>
): Promise<void> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId },
  });
  if (!appointment) return;
  if (['CANCELLED', 'COMPLETED', 'MISSED', 'NO_SHOW', 'EXPIRED', 'ARCHIVED'].includes(appointment.status)) {
    return;
  }

  await dispatchAppointmentNotification({
    appointmentId,
    businessId,
    notificationType: reminderLabelToNotificationType(label),
    templateKey: 'reminder',
    extras: { reminderLabel: label },
    scheduledAt: appointment.startTime,
    channels,
  });
}

export async function sendMissedAppointmentNotification(
  appointmentId: string,
  businessId: string
): Promise<void> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId },
    include: { customer: true },
  });
  if (!appointment) return;
  if (!['SCHEDULED', 'CONFIRMED', 'PENDING'].includes(appointment.status)) return;
  if (appointment.missedNotificationSent) return;

  const canRebookAfter = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: 'NO_SHOW',
      missedAt: new Date(),
      canRebookAfter,
      missedNotificationSent: true,
    },
  });

  await dispatchAppointmentNotification({
    appointmentId,
    businessId,
    notificationType: 'APPOINTMENT_NO_SHOW',
    templateKey: 'no_show',
  });

  await scheduleMissedFollowUp({
    appointmentId,
    businessId,
    customerPhone: appointment.primaryPhone ?? appointment.customer.phone,
    missedAt: new Date(),
  });
}

export async function sendMissedAppointmentFollowUp(
  appointmentId: string,
  businessId: string
): Promise<void> {
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, businessId } });
  if (!appointment) return;
  if (!['NO_SHOW', 'MISSED'].includes(appointment.status)) return;
  if (appointment.followUp24hSent) return;

  await dispatchAppointmentNotification({
    appointmentId,
    businessId,
    notificationType: 'FOLLOW_UP_24H',
    templateKey: 'follow_up',
  });

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { followUp24hSent: true },
  });
}

export async function sendAppointmentRejected(
  appointmentId: string,
  businessId: string,
  reason?: string
): Promise<void> {
  await cancelAppointmentReminderJobs(appointmentId);
  await cancelConfigurableReminders(appointmentId, businessId);

  await dispatchAppointmentNotification({
    appointmentId,
    businessId,
    notificationType: 'APPOINTMENT_REJECTED',
    templateKey: 'rejected',
    extras: { reason: reason ?? 'Not specified' },
  });

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'REJECTED' },
  });
}

export async function sendAppointmentRescheduled(
  appointmentId: string,
  businessId: string,
  previousStart?: Date
): Promise<void> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, businessId },
    include: { business: true },
  });
  if (!appointment) return;

  const tz = appointment.business.timezone;
  const prev = previousStart ?? appointment.startTime;
  const oldFmt = {
    date: prev.toLocaleDateString('en-GB', { timeZone: tz }),
    time: prev.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }),
  };
  const newFmt = {
    date: appointment.startTime.toLocaleDateString('en-GB', { timeZone: tz }),
    time: appointment.startTime.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }),
  };

  await dispatchAppointmentNotification({
    appointmentId,
    businessId,
    notificationType: 'APPOINTMENT_RESCHEDULED',
    templateKey: 'rescheduled',
    extras: {
      oldDate: oldFmt.date,
      oldTime: oldFmt.time,
      newDate: newFmt.date,
      newTime: newFmt.time,
    },
    attachIcs: true,
  });
}

export async function sendAppointmentCancelled(
  appointmentId: string,
  businessId: string,
  reason?: string
): Promise<void> {
  await cancelAppointmentReminderJobs(appointmentId);
  await cancelConfigurableReminders(appointmentId, businessId);

  await dispatchAppointmentNotification({
    appointmentId,
    businessId,
    notificationType: 'APPOINTMENT_CANCELLED',
    templateKey: 'cancelled',
    extras: reason ? { reason } : undefined,
  });
}

export async function sendAppointmentCompleted(
  appointmentId: string,
  businessId: string
): Promise<void> {
  await dispatchAppointmentNotification({
    appointmentId,
    businessId,
    notificationType: 'APPOINTMENT_COMPLETED',
    templateKey: 'completed',
  });
}

export async function sendAppointmentInProgress(
  appointmentId: string,
  businessId: string
): Promise<void> {
  await dispatchAppointmentNotification({
    appointmentId,
    businessId,
    notificationType: 'APPOINTMENT_IN_PROGRESS',
    templateKey: 'in_progress',
  });
}

export async function sendAppointmentExpired(
  appointmentId: string,
  businessId: string
): Promise<void> {
  await dispatchAppointmentNotification({
    appointmentId,
    businessId,
    notificationType: 'APPOINTMENT_EXPIRED',
    templateKey: 'expired',
  });
}

export async function processMissedAppointments(): Promise<void> {
  const cutoff = new Date();
  const overdue = await prisma.appointment.findMany({
    where: {
      startTime: { lt: cutoff },
      status: { in: ['SCHEDULED', 'CONFIRMED', 'PENDING'] },
      missedNotificationSent: false,
    },
    take: 50,
  });

  for (const appt of overdue) {
    await sendMissedAppointmentNotification(appt.id, appt.businessId).catch((error) => {
      logger.error('Batch missed appointment processing failed', { appointmentId: appt.id, error });
    });
  }
}

export async function processReminderJob(
  appointmentId: string,
  businessId: string,
  interval: ReminderInterval | 'configurable',
  config?: { label?: string; channels?: Array<'EMAIL' | 'WHATSAPP'> }
): Promise<void> {
  if (interval === 'configurable' && config?.label) {
    await sendConfigurableReminder(appointmentId, businessId, config.label, config.channels);
    return;
  }
  if (interval === 'missed') {
    await sendMissedAppointmentNotification(appointmentId, businessId);
    return;
  }
  if (interval === 'followup-24h') {
    await sendMissedAppointmentFollowUp(appointmentId, businessId);
    return;
  }
  await sendAppointmentReminder(
    appointmentId,
    businessId,
    interval as '30m' | '20m' | '10m'
  );
}

export async function scheduleAllReminders(params: {
  appointmentId: string;
  businessId: string;
  startTime: Date;
}) {
  await scheduleConfigurableReminders(params);
}

export async function resetAppointmentReminderFlags(appointmentId: string): Promise<void> {
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      reminderSent: false,
      reminder24hSent: false,
      reminder1hSent: false,
      reminder15mSent: false,
      reminder30mSent: false,
      reminder20mSent: false,
      reminder10mSent: false,
      missedNotificationSent: false,
      followUp24hSent: false,
    },
  });
}
