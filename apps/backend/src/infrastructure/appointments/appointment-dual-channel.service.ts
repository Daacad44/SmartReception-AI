import { emailService } from '../email/email.service';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { resolveStoredToken } from '../crypto/token-crypto';
import { logger } from '../../core/logger';
import {
  appointmentNotificationRepository,
  type AppointmentNotificationType,
} from './appointment-notification.repository';

export type ReminderInterval = '30m' | '20m' | '10m' | 'missed' | 'followup-24h';

export type AppointmentForNotification = {
  id: string;
  businessId: string;
  customerId: string;
  customer: {
    name: string;
    email: string | null;
    phone: string;
    whatsappNumber: string | null;
  };
  business: {
    whatsappAccounts: Array<{ phoneNumberId: string; accessToken: string | null }>;
  };
};

async function sendEmailChannel(
  recordId: string,
  to: string | null | undefined,
  subject: string,
  html: string
): Promise<boolean> {
  if (!to) {
    await appointmentNotificationRepository.markSkipped(recordId, 'Customer email not available');
    return false;
  }
  try {
    await emailService.send(to, subject, html);
    await appointmentNotificationRepository.markSent(recordId);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email send failed';
    await appointmentNotificationRepository.markFailed(recordId, message);
    logger.error('Appointment email notification failed', { recordId, error: message });
    return false;
  }
}

async function sendWhatsAppChannel(
  recordId: string,
  appointment: AppointmentForNotification,
  content: string
): Promise<boolean> {
  const whatsappAccount = appointment.business.whatsappAccounts[0];
  const phone = appointment.customer.whatsappNumber || appointment.customer.phone;

  if (!whatsappAccount?.accessToken || !phone) {
    await appointmentNotificationRepository.markSkipped(
      recordId,
      !whatsappAccount?.accessToken ? 'WhatsApp account not configured' : 'Customer phone not available'
    );
    return false;
  }

  try {
    const result = await whatsappService.sendOutbound({
      phoneNumberId: whatsappAccount.phoneNumberId,
      to: phone,
      accessToken: resolveStoredToken(whatsappAccount.accessToken),
      type: 'TEXT',
      content,
    });
    if (!result.success) {
      const errMsg =
        typeof result.error === 'string' ? result.error : JSON.stringify(result.error ?? 'WhatsApp send failed');
      await appointmentNotificationRepository.markFailed(recordId, errMsg);
      return false;
    }
    await appointmentNotificationRepository.markSent(recordId);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'WhatsApp send failed';
    await appointmentNotificationRepository.markFailed(recordId, message);
    logger.error('Appointment WhatsApp notification failed', { recordId, error: message });
    return false;
  }
}

/**
 * Sends an appointment notification on BOTH Email and WhatsApp.
 * Each channel is tracked independently in appointment_notifications.
 */
export async function dispatchDualChannelNotification(params: {
  appointment: AppointmentForNotification;
  notificationType: AppointmentNotificationType;
  emailSubject: string;
  emailHtml: string;
  whatsappMessage: string;
  scheduledAt?: Date;
}): Promise<{ emailSent: boolean; whatsappSent: boolean }> {
  const { appointment, notificationType } = params;

  const { isWhatsAppAutomationAllowed } = await import(
    '../../modules/subscription/subscription-license.service'
  );
  if (!(await isWhatsAppAutomationAllowed(appointment.businessId))) {
    logger.info('Appointment notifications blocked — invalid subscription', {
      businessId: appointment.businessId,
    });
    return { emailSent: false, whatsappSent: false };
  }

  const base = {
    appointmentId: appointment.id,
    businessId: appointment.businessId,
    customerId: appointment.customerId,
    notificationType,
    scheduledAt: params.scheduledAt,
  };

  const existingEmail = await appointmentNotificationRepository.findSent(
    appointment.id,
    notificationType,
    'EMAIL'
  );
  const existingWhatsApp = await appointmentNotificationRepository.findSent(
    appointment.id,
    notificationType,
    'WHATSAPP'
  );

  let emailRecord = existingEmail;
  if (!existingEmail || existingEmail.status !== 'SENT') {
    emailRecord = await appointmentNotificationRepository.upsertPending({
      ...base,
      channel: 'EMAIL',
    });
  }

  let whatsappRecord = existingWhatsApp;
  if (!existingWhatsApp || existingWhatsApp.status !== 'SENT') {
    whatsappRecord = await appointmentNotificationRepository.upsertPending({
      ...base,
      channel: 'WHATSAPP',
    });
  }

  const [emailSent, whatsappSent] = await Promise.all([
    existingEmail?.status === 'SENT'
      ? true
      : sendEmailChannel(emailRecord!.id, appointment.customer.email, params.emailSubject, params.emailHtml),
    existingWhatsApp?.status === 'SENT'
      ? true
      : sendWhatsAppChannel(whatsappRecord!.id, appointment, params.whatsappMessage),
  ]);

  if (!emailSent || !whatsappSent) {
    logger.warn('Dual-channel appointment notification incomplete', {
      appointmentId: appointment.id,
      notificationType,
      emailSent,
      whatsappSent,
    });
  }

  return { emailSent, whatsappSent };
}
