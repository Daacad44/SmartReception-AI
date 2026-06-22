import { prisma } from '../database/prisma';
import { emailService } from '../email/email.service';
import { whatsappService } from '../whatsapp/whatsapp.service';
import {
  appointmentConfirmationEmail,
  appointmentMissedEmail,
  appointmentReminderEmail,
} from '../email/templates';
import { logger } from '../../core/logger';

export type ReminderInterval = '24h' | '1h' | '15m';

function formatDateTime(date: Date, timezone = 'UTC'): { date: string; time: string } {
  return {
    date: date.toLocaleDateString('en-GB', { timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: date.toLocaleTimeString('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }),
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

export async function sendAppointmentConfirmation(
  appointmentId: string,
  businessId: string
): Promise<void> {
  const appointment = await loadAppointment(appointmentId, businessId);
  if (!appointment || !appointment.customer.email) return;

  const serviceName =
    appointment.serviceRequested || appointment.service?.name || appointment.title;
  const { date, time } = formatDateTime(appointment.startTime, appointment.business.timezone);

  const { subject, html } = appointmentConfirmationEmail({
    customerName: appointment.customer.name,
    serviceName,
    date,
    time,
    meetingLink: appointment.meetingLink || undefined,
    details: appointment.additionalNotes || appointment.description || undefined,
  });

  await emailService.send(appointment.customer.email, subject, html);

  const whatsappAccount = appointment.business.whatsappAccounts[0];
  if (whatsappAccount) {
    const waMessage = `Thank you, ${appointment.customer.name}.

Your appointment has been successfully scheduled.

Service: ${serviceName}
Date: ${date}
Time: ${time}

We look forward to speaking with you.`;

    await whatsappService.sendOutbound({
      phoneNumberId: whatsappAccount.phoneNumberId,
      to: appointment.customer.phone,
      accessToken: whatsappAccount.accessToken || undefined,
      type: 'TEXT',
      content: waMessage,
    });
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { confirmationSentAt: new Date(), status: 'CONFIRMED' },
  });
}

export async function sendAppointmentReminder(
  appointmentId: string,
  businessId: string,
  interval: ReminderInterval
): Promise<void> {
  const appointment = await loadAppointment(appointmentId, businessId);
  if (!appointment) return;
  if (['CANCELLED', 'COMPLETED', 'MISSED', 'NO_SHOW'].includes(appointment.status)) return;

  const flagKey =
    interval === '24h' ? 'reminder24hSent' : interval === '1h' ? 'reminder1hSent' : 'reminder15mSent';
  if (appointment[flagKey as keyof typeof appointment]) return;

  const serviceName =
    appointment.serviceRequested || appointment.service?.name || appointment.title;
  const { date, time } = formatDateTime(appointment.startTime, appointment.business.timezone);
  const reminderLabel = interval === '24h' ? '24 hours' : interval === '1h' ? '1 hour' : '15 minutes';

  if (appointment.customer.email) {
    const { subject, html } = appointmentReminderEmail({
      customerName: appointment.customer.name,
      serviceName,
      date,
      time,
      meetingLink: appointment.meetingLink || undefined,
      reminderLabel,
    });
    await emailService.send(appointment.customer.email, subject, html);
  }

  const whatsappAccount = appointment.business.whatsappAccounts[0];
  if (whatsappAccount) {
    const waMessage = `Reminder: Your appointment "${serviceName}" is in ${reminderLabel}.

Date: ${date}
Time: ${time}
${appointment.meetingLink ? `Meeting: ${appointment.meetingLink}` : ''}`;

    await whatsappService.sendOutbound({
      phoneNumberId: whatsappAccount.phoneNumberId,
      to: appointment.customer.phone,
      accessToken: whatsappAccount.accessToken || undefined,
      type: 'TEXT',
      content: waMessage,
    });
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { [flagKey]: true, reminderSent: true },
  });

  logger.info(`Appointment reminder sent`, { appointmentId, interval });
}

export async function sendMissedAppointmentNotification(
  appointmentId: string,
  businessId: string
): Promise<void> {
  const appointment = await loadAppointment(appointmentId, businessId);
  if (!appointment) return;

  const canRebookAfter = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: 'MISSED',
      missedAt: new Date(),
      canRebookAfter,
    },
  });

  if (appointment.customer.email) {
    const { subject, html } = appointmentMissedEmail({ customerName: appointment.customer.name });
    await emailService.send(appointment.customer.email, subject, html);
  }

  const whatsappAccount = appointment.business.whatsappAccounts[0];
  if (whatsappAccount) {
    await whatsappService.sendOutbound({
      phoneNumberId: whatsappAccount.phoneNumberId,
      to: appointment.customer.phone,
      accessToken: whatsappAccount.accessToken || undefined,
      type: 'TEXT',
      content: `We noticed that your appointment was missed.\n\nYou may book a new appointment after 24 hours.`,
    });
  }
}

export async function processMissedAppointments(): Promise<void> {
  const graceMinutes = 15;
  const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000);

  const overdue = await prisma.appointment.findMany({
    where: {
      endTime: { lt: cutoff },
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
    },
    take: 50,
  });

  for (const appt of overdue) {
    await sendMissedAppointmentNotification(appt.id, appt.businessId);
  }
}

async function sendWhatsAppToCustomer(
  appointment: NonNullable<Awaited<ReturnType<typeof loadAppointment>>>,
  content: string
): Promise<boolean> {
  const whatsappAccount = appointment.business.whatsappAccounts[0];
  if (!whatsappAccount) return false;

  const phone = appointment.customer.whatsappNumber || appointment.customer.phone;
  const result = await whatsappService.sendOutbound({
    phoneNumberId: whatsappAccount.phoneNumberId,
    to: phone,
    accessToken: whatsappAccount.accessToken || undefined,
    type: 'TEXT',
    content,
  });
  return result.success;
}

export async function sendAppointmentApproved(
  appointmentId: string,
  businessId: string
): Promise<void> {
  const appointment = await loadAppointment(appointmentId, businessId);
  if (!appointment) return;

  const { date, time } = formatDateTime(appointment.startTime, appointment.business.timezone);
  const customerName = appointment.customer.name;

  const waMessage = `Mahadsanid ${customerName}.

Ballantaadii waa la aqbalay.

Fadlan waqtiga nala ilaali si aan kuu siino adeegga ugu wanaagsan.

Taariikh:
${date}

Saacad:
${time}

Haddii aad u baahan tahay isbeddel fadlan nala soo xiriir.`;

  await sendWhatsAppToCustomer(appointment, waMessage);

  if (appointment.customer.email) {
    const serviceName =
      appointment.serviceRequested || appointment.service?.name || appointment.title;
    const { subject, html } = appointmentConfirmationEmail({
      customerName,
      serviceName,
      date,
      time,
      meetingLink: appointment.meetingLink || undefined,
      details: appointment.additionalNotes || appointment.description || undefined,
    });
    await emailService.send(appointment.customer.email, subject, html);
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { confirmationSentAt: new Date() },
  });
}

export async function sendAppointmentRejected(
  appointmentId: string,
  businessId: string,
  reason?: string
): Promise<void> {
  const appointment = await loadAppointment(appointmentId, businessId);
  if (!appointment) return;

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

  const serviceName =
    appointment.serviceRequested || appointment.service?.name || appointment.title;
  const { date, time } = formatDateTime(appointment.startTime, appointment.business.timezone);

  const waMessage = `Mahadsanid ${appointment.customer.name}.

Ballantaadii waa la beddelay.

Adeegga: ${serviceName}
Taariikh: ${date}
Saacad: ${time}

Fadlan waqtiga cusub nala ilaali.`;

  await sendWhatsAppToCustomer(appointment, waMessage);

  if (appointment.customer.email) {
    const { subject, html } = appointmentConfirmationEmail({
      customerName: appointment.customer.name,
      serviceName,
      date,
      time,
      meetingLink: appointment.meetingLink || undefined,
      details: 'Your appointment has been rescheduled.',
    });
    await emailService.send(appointment.customer.email, subject, html);
  }
}

export async function sendAppointmentCancelled(
  appointmentId: string,
  businessId: string
): Promise<void> {
  const appointment = await loadAppointment(appointmentId, businessId);
  if (!appointment) return;

  const serviceName =
    appointment.serviceRequested || appointment.service?.name || appointment.title;
  const { date, time } = formatDateTime(appointment.startTime, appointment.business.timezone);

  const waMessage = `Mahadsanid ${appointment.customer.name}.

Ballantaadii waa la joojiyay.

Adeegga: ${serviceName}
Taariikh: ${date}
Saacad: ${time}

Fadlan nala soo xiriir haddii aad rabto inaad waqti cusub ballansato.`;

  await sendWhatsAppToCustomer(appointment, waMessage);
}
