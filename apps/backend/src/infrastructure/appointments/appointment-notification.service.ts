import { prisma } from '../database/prisma';
import {
  appointmentConfirmationEmail,
  appointmentApprovedEmail,
  appointmentMissedEmail,
  appointmentMissedFollowUpEmail,
  appointmentReminderEmail,
} from '../email/templates';
import { logger } from '../../core/logger';
import {
  dispatchDualChannelNotification,
  type ReminderInterval,
} from './appointment-dual-channel.service';
import {
  cancelAppointmentReminderJobs,
  scheduleMissedFollowUp,
} from './appointment-scheduler.service';

export type { ReminderInterval };

function formatDateTime(date: Date, timezone = 'UTC'): { date: string; time: string } {
  return {
    date: date.toLocaleDateString('en-GB', {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

async function loadAppointment(appointmentId: string, businessId: string) {
  return prisma.appointment.findFirst({
    where: { id: appointmentId, businessId },
    include: {
      customer: true,
      service: true,
      business: { include: { whatsappAccounts: { where: { isActive: true }, take: 1 } } },
    },
  });
}

function serviceName(appointment: NonNullable<Awaited<ReturnType<typeof loadAppointment>>>) {
  return appointment.serviceRequested || appointment.service?.name || appointment.title;
}

const REMINDER_FLAG: Record<'30m' | '20m' | '10m', string> = {
  '30m': 'reminder30mSent',
  '20m': 'reminder20mSent',
  '10m': 'reminder10mSent',
};

const REMINDER_TYPE: Record<'30m' | '20m' | '10m', 'REMINDER_30_MIN' | 'REMINDER_20_MIN' | 'REMINDER_10_MIN'> = {
  '30m': 'REMINDER_30_MIN',
  '20m': 'REMINDER_20_MIN',
  '10m': 'REMINDER_10_MIN',
};

const REMINDER_LABEL: Record<'30m' | '20m' | '10m', string> = {
  '30m': '30 minutes',
  '20m': '20 minutes',
  '10m': '10 minutes',
};

export async function sendAppointmentConfirmation(
  appointmentId: string,
  businessId: string
): Promise<void> {
  const appointment = await loadAppointment(appointmentId, businessId);
  if (!appointment) return;

  const svc = serviceName(appointment);
  const { date, time } = formatDateTime(appointment.startTime, appointment.business.timezone);
  const customerName = appointment.customer.name;

  const whatsappMessage = `Hello ${customerName}

Your appointment has been successfully scheduled.

Date:
${date}

Time:
${time}

Service:
${svc}

Thank you.`;

  const { subject, html } = appointmentConfirmationEmail({
    customerName,
    serviceName: svc,
    date,
    time,
    meetingLink: appointment.meetingLink || undefined,
    details: appointment.additionalNotes || appointment.description || undefined,
  });

  await dispatchDualChannelNotification({
    appointment,
    notificationType: 'APPOINTMENT_CREATED',
    emailSubject: subject,
    emailHtml: html,
    whatsappMessage,
  });

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { confirmationSentAt: new Date(), status: 'CONFIRMED' },
  });
}

export async function sendAppointmentApproved(
  appointmentId: string,
  businessId: string
): Promise<void> {
  const appointment = await loadAppointment(appointmentId, businessId);
  if (!appointment) return;

  const { date, time } = formatDateTime(appointment.startTime, appointment.business.timezone);
  const customerName = appointment.customer.name;

  const whatsappMessage = `Hello ${customerName}

Your appointment has been approved.

Please be available at the scheduled time.

Date:
${date}

Time:
${time}

We look forward to serving you.`;

  const { subject, html } = appointmentApprovedEmail({ customerName, date, time });

  await dispatchDualChannelNotification({
    appointment,
    notificationType: 'APPOINTMENT_APPROVED',
    emailSubject: subject,
    emailHtml: html,
    whatsappMessage,
  });

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { confirmationSentAt: new Date() },
  });
}

export async function sendAppointmentReminder(
  appointmentId: string,
  businessId: string,
  interval: '30m' | '20m' | '10m'
): Promise<void> {
  const appointment = await loadAppointment(appointmentId, businessId);
  if (!appointment) return;
  if (['CANCELLED', 'COMPLETED', 'MISSED', 'NO_SHOW'].includes(appointment.status)) return;

  const flagKey = REMINDER_FLAG[interval];
  if (appointment[flagKey as keyof typeof appointment]) return;

  const svc = serviceName(appointment);
  const { date, time } = formatDateTime(appointment.startTime, appointment.business.timezone);
  const remaining = REMINDER_LABEL[interval];
  const customerName = appointment.customer.name;

  const whatsappMessage = `Hello ${customerName}

This is a reminder that your appointment is scheduled in:

${remaining}

Appointment Time:
${time}

Please prepare accordingly.

Thank you.`;

  const { subject, html } = appointmentReminderEmail({
    customerName,
    serviceName: svc,
    date,
    time,
    meetingLink: appointment.meetingLink || undefined,
    reminderLabel: remaining,
  });

  await dispatchDualChannelNotification({
    appointment,
    notificationType: REMINDER_TYPE[interval],
    emailSubject: subject,
    emailHtml: html,
    whatsappMessage,
    scheduledAt: appointment.startTime,
  });

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { [flagKey]: true, reminderSent: true },
  });

  logger.info('Appointment reminder sent', { appointmentId, interval });
}

export async function sendMissedAppointmentNotification(
  appointmentId: string,
  businessId: string
): Promise<void> {
  const appointment = await loadAppointment(appointmentId, businessId);
  if (!appointment) return;

  if (!['SCHEDULED', 'CONFIRMED'].includes(appointment.status)) return;
  if (appointment.missedNotificationSent) return;

  const customerName = appointment.customer.name;
  const canRebookAfter = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: 'MISSED',
      missedAt: new Date(),
      canRebookAfter,
      missedNotificationSent: true,
    },
  });

  const whatsappMessage = `Hello ${customerName}

Your appointment time has passed.

If you still need assistance, please contact us or schedule a new appointment.

Thank you.`;

  const { subject, html } = appointmentMissedEmail({ customerName });

  await dispatchDualChannelNotification({
    appointment,
    notificationType: 'MISSED_APPOINTMENT',
    emailSubject: subject,
    emailHtml: html,
    whatsappMessage,
  });

  await scheduleMissedFollowUp({
    appointmentId,
    businessId,
    customerPhone: appointment.customer.phone,
    missedAt: new Date(),
  });
}

export async function sendMissedAppointmentFollowUp(
  appointmentId: string,
  businessId: string
): Promise<void> {
  const appointment = await loadAppointment(appointmentId, businessId);
  if (!appointment) return;
  if (appointment.status !== 'MISSED') return;
  if (appointment.followUp24hSent) return;

  const customerName = appointment.customer.name;

  const whatsappMessage = `Hello ${customerName}

We noticed that your appointment was missed.

Would you like to book a new appointment?

Reply to this message or contact us to reschedule.`;

  const { subject, html } = appointmentMissedFollowUpEmail({ customerName });

  await dispatchDualChannelNotification({
    appointment,
    notificationType: 'FOLLOW_UP_24H',
    emailSubject: subject,
    emailHtml: html,
    whatsappMessage,
  });

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { followUp24hSent: true },
  });
}

export async function processMissedAppointments(): Promise<void> {
  const cutoff = new Date();

  const overdue = await prisma.appointment.findMany({
    where: {
      startTime: { lt: cutoff },
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      missedNotificationSent: false,
    },
    take: 50,
  });

  for (const appt of overdue) {
    await sendMissedAppointmentNotification(appt.id, appt.businessId).catch((error) => {
      logger.error('Batch missed appointment processing failed', {
        appointmentId: appt.id,
        error,
      });
    });
  }
}

export async function processReminderJob(
  appointmentId: string,
  businessId: string,
  interval: ReminderInterval
): Promise<void> {
  if (interval === 'missed') {
    await sendMissedAppointmentNotification(appointmentId, businessId);
    return;
  }
  if (interval === 'followup-24h') {
    await sendMissedAppointmentFollowUp(appointmentId, businessId);
    return;
  }
  await sendAppointmentReminder(appointmentId, businessId, interval);
}

async function sendWhatsAppToCustomer(
  appointment: NonNullable<Awaited<ReturnType<typeof loadAppointment>>>,
  content: string
): Promise<boolean> {
  const whatsappAccount = appointment.business.whatsappAccounts[0];
  if (!whatsappAccount) return false;

  const phone = appointment.customer.whatsappNumber || appointment.customer.phone;
  const { whatsappService } = await import('../whatsapp/whatsapp.service');
  const { resolveStoredToken } = await import('../crypto/token-crypto');

  const result = await whatsappService.sendOutbound({
    phoneNumberId: whatsappAccount.phoneNumberId,
    to: phone,
    accessToken: resolveStoredToken(whatsappAccount.accessToken),
    type: 'TEXT',
    content,
  });
  return result.success;
}

export async function sendAppointmentRejected(
  appointmentId: string,
  businessId: string,
  reason?: string
): Promise<void> {
  const appointment = await loadAppointment(appointmentId, businessId);
  if (!appointment) return;

  await cancelAppointmentReminderJobs(appointmentId);

  const waMessage = `Mahadsanid ${appointment.customer.name}.

Waan ka xunnahay, ballantaadii lama aqbali karin${reason ? `.\n\nSababta: ${reason}` : '.'}

Fadlan nala soo xiriir si aad waqti kale u ballansato.`;

  await sendWhatsAppToCustomer(appointment, waMessage);
}

export async function sendAppointmentRescheduled(
  appointmentId: string,
  businessId: string
): Promise<void> {
  const appointment = await loadAppointment(appointmentId, businessId);
  if (!appointment) return;

  const svc = serviceName(appointment);
  const { date, time } = formatDateTime(appointment.startTime, appointment.business.timezone);

  const waMessage = `Mahadsanid ${appointment.customer.name}.

Ballantaadii waa la beddelay.

Adeegga: ${svc}
Taariikh: ${date}
Saacad: ${time}

Fadlan waqtiga cusub nala ilaali.`;

  await sendWhatsAppToCustomer(appointment, waMessage);

  if (appointment.customer.email) {
    const { subject, html } = appointmentConfirmationEmail({
      customerName: appointment.customer.name,
      serviceName: svc,
      date,
      time,
      meetingLink: appointment.meetingLink || undefined,
      details: 'Your appointment has been rescheduled.',
    });
    const { emailService } = await import('../email/email.service');
    await emailService.send(appointment.customer.email, subject, html);
  }
}

export async function sendAppointmentCancelled(
  appointmentId: string,
  businessId: string
): Promise<void> {
  const appointment = await loadAppointment(appointmentId, businessId);
  if (!appointment) return;

  await cancelAppointmentReminderJobs(appointmentId);

  const svc = serviceName(appointment);
  const { date, time } = formatDateTime(appointment.startTime, appointment.business.timezone);

  const waMessage = `Mahadsanid ${appointment.customer.name}.

Ballantaadii waa la joojiyay.

Adeegga: ${svc}
Taariikh: ${date}
Saacad: ${time}

Fadlan nala soo xiriir haddii aad rabto inaad waqti cusub ballansato.`;

  await sendWhatsAppToCustomer(appointment, waMessage);
}

export async function resetAppointmentReminderFlags(appointmentId: string): Promise<void> {
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      reminderSent: false,
      reminder30mSent: false,
      reminder20mSent: false,
      reminder10mSent: false,
      missedNotificationSent: false,
      followUp24hSent: false,
    },
  });
}
