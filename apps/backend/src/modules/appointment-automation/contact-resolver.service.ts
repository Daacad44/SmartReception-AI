import type { Appointment, Customer } from '@prisma/client';
import type { AppointmentContactRecipient } from './types';

type AppointmentWithCustomer = Appointment & { customer: Customer };

export class AppointmentContactResolverService {
  resolveRecipients(appointment: AppointmentWithCustomer, businessEmail?: string | null): AppointmentContactRecipient[] {
    const recipients: AppointmentContactRecipient[] = [];
    const seen = new Set<string>();

    const add = (channel: AppointmentContactRecipient['channel'], value: string | null | undefined, label: string) => {
      const normalized = value?.trim();
      if (!normalized) return;
      const key = `${channel}:${normalized.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      recipients.push({ channel, value: normalized, label });
    };

    add('WHATSAPP', appointment.primaryPhone, 'Primary Phone');
    add('WHATSAPP', appointment.secondaryPhone, 'Secondary Phone');
    add('WHATSAPP', appointment.guardianPhone, 'Guardian Phone');
    add('WHATSAPP', appointment.companyPhone, 'Company Phone');
    add('WHATSAPP', appointment.customer.phone, 'Customer Phone');
    add('WHATSAPP', appointment.customer.whatsappNumber, 'Customer WhatsApp');

    add('EMAIL', appointment.primaryEmail, 'Primary Email');
    add('EMAIL', appointment.secondaryEmail, 'Secondary Email');
    add('EMAIL', appointment.guardianEmail, 'Guardian Email');
    add('EMAIL', appointment.businessEmail, 'Business Email');
    add('EMAIL', appointment.customer.email, 'Customer Email');
    add('EMAIL', businessEmail ?? undefined, 'Business Contact');

    return recipients;
  }

  buildContactFields(
    appointment: Partial<Appointment>,
    customer: Customer,
    businessEmail?: string | null
  ) {
    return {
      primaryPhone: appointment.primaryPhone ?? customer.phone,
      secondaryPhone: appointment.secondaryPhone,
      guardianPhone: appointment.guardianPhone,
      companyPhone: appointment.companyPhone ?? customer.companyName ? customer.phone : undefined,
      primaryEmail: appointment.primaryEmail ?? customer.email,
      secondaryEmail: appointment.secondaryEmail,
      guardianEmail: appointment.guardianEmail,
      businessEmail: appointment.businessEmail ?? businessEmail ?? undefined,
    };
  }
}

export const appointmentContactResolverService = new AppointmentContactResolverService();
