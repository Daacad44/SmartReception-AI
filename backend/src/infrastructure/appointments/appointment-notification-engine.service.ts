import type {
  AppointmentNotificationChannel,
  AppointmentNotificationType,
} from '@prisma/client';
import { prisma } from '../database/prisma';
import { emailService } from '../email/email.service';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { resolveStoredToken } from '../crypto/token-crypto';
import { logger } from '../../core/logger';
import {
  appointmentNotificationRepository,
} from './appointment-notification.repository';
import {
  appointmentTemplateService,
  type AppointmentTemplateKey,
} from './appointment-template.service';
import { appointmentContactResolverService } from '../../modules/appointment-automation/contact-resolver.service';
import { appointmentCalendarSyncService } from '../../modules/appointment-automation/calendar-sync.service';
import { appointmentTimelineService } from '../../modules/appointment-automation/timeline.service';
import type { AppointmentTemplateVariables } from '../../modules/appointment-automation/types';
import { appointmentConfirmationEmail } from '../email/templates';

export interface DispatchNotificationParams {
  appointmentId: string;
  businessId: string;
  notificationType: AppointmentNotificationType;
  templateKey: AppointmentTemplateKey;
  extras?: Record<string, string>;
  scheduledAt?: Date;
  channels?: AppointmentNotificationChannel[];
  attachIcs?: boolean;
}

function formatDateTime(date: Date, timezone = 'UTC') {
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

function serviceName(appointment: {
  serviceRequested?: string | null;
  service?: { name: string } | null;
  title: string;
}) {
  return appointment.serviceRequested || appointment.service?.name || appointment.title;
}

async function loadAppointment(appointmentId: string, businessId: string) {
  return prisma.appointment.findFirst({
    where: { id: appointmentId, businessId },
    include: {
      customer: true,
      service: true,
      assignedTo: true,
      business: { include: { whatsappAccounts: { where: { isActive: true }, take: 1 } } },
    },
  });
}

function buildTemplateVariables(
  appointment: NonNullable<Awaited<ReturnType<typeof loadAppointment>>>
): AppointmentTemplateVariables {
  const bookingNumber = appointment.bookingNumber ?? appointment.id.slice(0, 8).toUpperCase();
  const { date, time } = formatDateTime(appointment.startTime, appointment.business.timezone);
  const employee = appointment.assignedTo
    ? `${appointment.assignedTo.firstName ?? ''} ${appointment.assignedTo.lastName ?? ''}`.trim()
    : 'Team';

  const variables: AppointmentTemplateVariables = {
    businessName: appointment.business.name,
    customerName: appointment.customer.name,
    appointmentDate: date,
    appointmentTime: time,
    assignedEmployee: employee || 'Team',
    service: serviceName(appointment),
    bookingNumber,
    location: appointment.location ?? appointment.business.address ?? '',
    rescheduleLink: `Reply to reschedule`,
    cancelLink: `Reply to cancel`,
    googleCalendarLink: '',
    outlookCalendarLink: '',
    appleCalendarLink: '',
  };

  const links = appointmentCalendarSyncService.buildCalendarLinks(
    variables,
    appointment.startTime,
    appointment.endTime
  );
  variables.googleCalendarLink = links.googleCalendarLink;
  variables.outlookCalendarLink = links.outlookCalendarLink;
  variables.appleCalendarLink = links.appleCalendarLink;

  return variables;
}

async function sendEmail(
  recordId: string,
  to: string,
  subject: string,
  html: string,
  icsContent?: string | null
): Promise<boolean> {
  try {
    if (icsContent) {
      await emailService.sendWithAttachment(to, subject, html, [
        {
          filename: 'appointment.ics',
          content: icsContent,
          contentType: 'text/calendar',
        },
      ]);
    } else {
      await emailService.send(to, subject, html);
    }
    await appointmentNotificationRepository.markSent(recordId);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email send failed';
    await appointmentNotificationRepository.markFailed(recordId, message);
    logger.error('Appointment email failed', { recordId, to, error: message });
    return false;
  }
}

async function sendWhatsApp(
  recordId: string,
  phoneNumberId: string,
  accessToken: string,
  to: string,
  content: string
): Promise<boolean> {
  try {
    const result = await whatsappService.sendOutbound({
      phoneNumberId,
      to,
      accessToken,
      type: 'TEXT',
      content,
    });
    if (!result.success) {
      const errMsg =
        typeof result.error === 'string' ? result.error : JSON.stringify(result.error ?? 'WhatsApp failed');
      await appointmentNotificationRepository.markFailed(recordId, errMsg);
      return false;
    }
    await appointmentNotificationRepository.markSent(recordId, result.whatsappMsgId ?? undefined);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'WhatsApp send failed';
    await appointmentNotificationRepository.markFailed(recordId, message);
    logger.error('Appointment WhatsApp failed', { recordId, to, error: message });
    return false;
  }
}

export async function dispatchAppointmentNotification(
  params: DispatchNotificationParams
): Promise<{ sent: number; failed: number }> {
  const appointment = await loadAppointment(params.appointmentId, params.businessId);
  if (!appointment) return { sent: 0, failed: 0 };

  const { isWhatsAppAutomationAllowed } = await import(
    '../../modules/subscription/subscription-license.service'
  );
  if (!(await isWhatsAppAutomationAllowed(params.businessId))) {
    logger.info('Appointment notifications blocked — invalid subscription', {
      businessId: params.businessId,
    });
    return { sent: 0, failed: 0 };
  }

  const variables = buildTemplateVariables(appointment);
  const extras = {
    ...params.extras,
    supportPhone: appointment.business.phone ?? '',
    supportEmail: appointment.business.email ?? '',
  };

  const recipients = appointmentContactResolverService.resolveRecipients(
    appointment,
    appointment.business.email
  );

  const channels = params.channels ?? ['EMAIL', 'WHATSAPP'];
  const whatsappAccount = appointment.business.whatsappAccounts[0];
  let sent = 0;
  let failed = 0;

  for (const channel of channels) {
    const channelRecipients = recipients.filter((r) => {
      if (channel === 'EMAIL') return r.channel === 'EMAIL';
      if (channel === 'WHATSAPP') return r.channel === 'WHATSAPP';
      return false;
    });

    if (!channelRecipients.length) {
      logger.debug('No recipients for channel', {
        appointmentId: params.appointmentId,
        channel,
      });
      continue;
    }

    const rendered = await appointmentTemplateService.render({
      businessId: params.businessId,
      templateKey: params.templateKey,
      channel,
      variables,
      extras,
    });

    for (const recipient of channelRecipients) {
      const existing = await appointmentNotificationRepository.findSent(
        params.appointmentId,
        params.notificationType,
        channel,
        recipient.value
      );
      if (existing?.status === 'SENT') {
        sent++;
        continue;
      }

      const record = await appointmentNotificationRepository.upsertPending({
        appointmentId: params.appointmentId,
        businessId: params.businessId,
        customerId: appointment.customerId,
        notificationType: params.notificationType,
        channel,
        recipient: recipient.value,
        templateKey: params.templateKey,
        scheduledAt: params.scheduledAt,
      });

      let success = false;
      if (channel === 'EMAIL') {
        const { subject, html } = appointmentConfirmationEmail({
          customerName: variables.customerName,
          serviceName: variables.service,
          date: variables.appointmentDate,
          time: variables.appointmentTime,
          meetingLink: appointment.meetingLink || undefined,
          details: rendered.body.replace(/<br \/>/g, '\n'),
          businessName: variables.businessName,
          bookingNumber: variables.bookingNumber,
          location: variables.location,
          calendarLinks: {
            google: variables.googleCalendarLink,
            outlook: variables.outlookCalendarLink,
            apple: variables.appleCalendarLink,
          },
          logoUrl: appointment.business.logoUrl ?? undefined,
        });
        const emailSubject = rendered.subject ?? subject;
        success = await sendEmail(
          record.id,
          recipient.value,
          emailSubject,
          html,
          params.attachIcs ? appointment.icsContent : null
        );
      } else if (channel === 'WHATSAPP' && whatsappAccount?.accessToken) {
        const token = resolveStoredToken(whatsappAccount.accessToken);
        if (!token) {
          await appointmentNotificationRepository.markSkipped(record.id, 'WhatsApp token unavailable');
        } else {
          const waBody = rendered.body.replace(/<br \/>/g, '\n');
          success = await sendWhatsApp(
            record.id,
            whatsappAccount.phoneNumberId,
            token,
            recipient.value,
            waBody
          );
        }
      } else {
        await appointmentNotificationRepository.markSkipped(
          record.id,
          channel === 'WHATSAPP' ? 'WhatsApp not configured' : 'Channel unavailable'
        );
      }

      if (success) sent++;
      else failed++;
    }
  }

  await appointmentTimelineService.record({
    businessId: params.businessId,
    appointmentId: params.appointmentId,
    eventType: mapTimelineEvent(params.notificationType),
    channel: channels.length === 2 ? 'EMAIL' : channels[0],
    metadata: {
      notificationType: params.notificationType,
      templateKey: params.templateKey,
      sent,
      failed,
    },
  });

  return { sent, failed };
}

function mapTimelineEvent(type: AppointmentNotificationType): string {
  if (type.startsWith('REMINDER_')) return 'REMINDER_SENT';
  if (type === 'APPOINTMENT_CREATED' || type === 'APPOINTMENT_CONFIRMED') return 'CONFIRMATION_SENT';
  if (type === 'APPOINTMENT_COMPLETED') return 'APPOINTMENT_COMPLETED';
  if (type === 'APPOINTMENT_CANCELLED') return 'APPOINTMENT_CANCELLED';
  if (type === 'APPOINTMENT_RESCHEDULED') return 'APPOINTMENT_RESCHEDULED';
  if (type === 'APPOINTMENT_REJECTED') return 'APPOINTMENT_REJECTED';
  if (type === 'APPOINTMENT_NO_SHOW' || type === 'MISSED_APPOINTMENT') return 'APPOINTMENT_NO_SHOW';
  return 'NOTIFICATION_SENT';
}

export function reminderLabelToNotificationType(label: string): AppointmentNotificationType {
  const normalized = label.toLowerCase();
  if (normalized.includes('24')) return 'REMINDER_24_HOURS';
  if (normalized.includes('12')) return 'REMINDER_12_HOURS';
  if (normalized.includes('6 hour')) return 'REMINDER_6_HOURS';
  if (normalized.includes('1 hour') || normalized.includes('1h')) return 'REMINDER_1_HOUR';
  if (normalized.includes('15')) return 'REMINDER_15_MINUTES';
  if (normalized.includes('30')) return 'REMINDER_30_MIN';
  if (normalized.includes('20')) return 'REMINDER_20_MIN';
  if (normalized.includes('10')) return 'REMINDER_10_MIN';
  return 'REMINDER_1_HOUR';
}
