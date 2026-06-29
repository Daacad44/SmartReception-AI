import type { AppointmentNotificationChannel } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import type { AppointmentTemplateVariables } from '../../modules/appointment-automation/types';

export type AppointmentTemplateKey =
  | 'confirmation'
  | 'confirmed'
  | 'pending'
  | 'reminder'
  | 'completed'
  | 'cancelled'
  | 'rescheduled'
  | 'rejected'
  | 'no_show'
  | 'expired'
  | 'in_progress'
  | 'follow_up';

const VARIABLE_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;

const VARIABLE_ALIASES: Record<string, keyof AppointmentTemplateVariables | 'appointmentId' | 'status' | 'reason' | 'reminderLabel' | 'oldDate' | 'oldTime' | 'newDate' | 'newTime' | 'supportPhone' | 'supportEmail'> = {
  'Business Name': 'businessName',
  'Customer Name': 'customerName',
  'Appointment ID': 'bookingNumber',
  'Reference Number': 'bookingNumber',
  'Date': 'appointmentDate',
  'Time': 'appointmentTime',
  'Service': 'service',
  'Employee': 'assignedEmployee',
  'Phone': 'supportPhone',
  'Email': 'supportEmail',
  'Location': 'location',
  'Reschedule Link': 'rescheduleLink',
  'Cancel Link': 'cancelLink',
};

export interface RenderedTemplate {
  subject?: string;
  body: string;
  templateKey: string;
  source: 'business' | 'default';
}

const DEFAULT_WHATSAPP: Record<AppointmentTemplateKey, string> = {
  confirmation: `Hello {{Customer Name}}

Your appointment request has been received successfully.

Business:
{{Business Name}}

Service:
{{Service}}

Date:
{{Date}}

Time:
{{Time}}

Status:
Confirmed

Your requested appointment has been accepted.

Please arrive on time.

If you need to reschedule or cancel, reply to this message.

Reference Number:
{{Appointment ID}}

Thank you.`,
  confirmed: `Hello {{Customer Name}}

Your appointment with {{Business Name}} has been confirmed.

Service: {{Service}}
Date: {{Date}}
Time: {{Time}}

Reference Number: {{Appointment ID}}

Please arrive on time.`,
  pending: `Hello {{Customer Name}}

Your appointment request with {{Business Name}} is pending review.

Service: {{Service}}
Date: {{Date}}
Time: {{Time}}

Reference Number: {{Appointment ID}}

We will notify you once it is confirmed.`,
  reminder: `Hello {{Customer Name}}

This is a reminder for your appointment with {{Business Name}}.

{{reminderLabel}}

Service: {{Service}}
Date: {{Date}}
Time: {{Time}}

Reference Number: {{Appointment ID}}

Reschedule: {{Reschedule Link}}
Cancel: {{Cancel Link}}`,
  completed: `Hello {{Customer Name}}

Your appointment with {{Business Name}} has been completed successfully.

Thank you for choosing our services.

We appreciate your trust.

If you have feedback, please reply to this message.

We look forward to serving you again.`,
  cancelled: `Hello {{Customer Name}}

Your appointment with {{Business Name}} has been cancelled.

Service: {{Service}}
Date: {{Date}}
Time: {{Time}}

Reference Number: {{Appointment ID}}

If you would like to reschedule, please reply to this message.`,
  rescheduled: `Hello {{Customer Name}}

Your appointment with {{Business Name}} has been rescheduled.

Service: {{Service}}

Previous Date: {{oldDate}}
Previous Time: {{oldTime}}

New Date: {{newDate}}
New Time: {{newTime}}

Reference Number: {{Appointment ID}}`,
  rejected: `Hello {{Customer Name}}

We regret to inform you that your appointment request with {{Business Name}} could not be accepted.

{{reason}}

Reference Number: {{Appointment ID}}

Please contact us to schedule another time.`,
  no_show: `Hello {{Customer Name}}

We noticed you were unable to attend your appointment with {{Business Name}}.

Reference Number: {{Appointment ID}}

Please reply if you would like to book a new appointment.`,
  expired: `Hello {{Customer Name}}

Your appointment request with {{Business Name}} has expired.

Reference Number: {{Appointment ID}}

Please contact us if you would like to book again.`,
  in_progress: `Hello {{Customer Name}}

Your appointment with {{Business Name}} is now in progress.

Service: {{Service}}
Reference Number: {{Appointment ID}}`,
  follow_up: `Hello {{Customer Name}}

We noticed that your appointment with {{Business Name}} was missed.

Would you like to book a new appointment?

Reply to this message or contact us to reschedule.`,
};

const DEFAULT_EMAIL_SUBJECT: Record<AppointmentTemplateKey, string> = {
  confirmation: 'Appointment Confirmation – {{Business Name}}',
  confirmed: 'Appointment Confirmed – {{Business Name}}',
  pending: 'Appointment Pending – {{Business Name}}',
  reminder: 'Appointment Reminder – {{Business Name}}',
  completed: 'Appointment Completed – {{Business Name}}',
  cancelled: 'Appointment Cancelled – {{Business Name}}',
  rescheduled: 'Appointment Rescheduled – {{Business Name}}',
  rejected: 'Appointment Not Accepted – {{Business Name}}',
  no_show: 'Missed Appointment – {{Business Name}}',
  expired: 'Appointment Expired – {{Business Name}}',
  in_progress: 'Appointment In Progress – {{Business Name}}',
  follow_up: 'Reschedule Your Appointment – {{Business Name}}',
};

function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(VARIABLE_PATTERN, (_, rawKey: string) => {
    const key = rawKey.trim();
    const alias = VARIABLE_ALIASES[key];
    if (alias && vars[alias]) return vars[alias];
    if (vars[key]) return vars[key];
    return `{{${key}}}`;
  });
}

export function buildVariableMap(
  variables: AppointmentTemplateVariables,
  extras?: Record<string, string>
): Record<string, string> {
  return {
    businessName: variables.businessName,
    customerName: variables.customerName,
    appointmentDate: variables.appointmentDate,
    appointmentTime: variables.appointmentTime,
    assignedEmployee: variables.assignedEmployee,
    service: variables.service,
    bookingNumber: variables.bookingNumber,
    location: variables.location,
    rescheduleLink: variables.rescheduleLink,
    cancelLink: variables.cancelLink,
    googleCalendarLink: variables.googleCalendarLink,
    outlookCalendarLink: variables.outlookCalendarLink,
    appleCalendarLink: variables.appleCalendarLink,
    supportPhone: extras?.supportPhone ?? '',
    supportEmail: extras?.supportEmail ?? '',
    reminderLabel: extras?.reminderLabel ?? '',
    reason: extras?.reason ?? '',
    oldDate: extras?.oldDate ?? '',
    oldTime: extras?.oldTime ?? '',
    newDate: extras?.newDate ?? variables.appointmentDate,
    newTime: extras?.newTime ?? variables.appointmentTime,
    status: extras?.status ?? '',
  };
}

export class AppointmentTemplateService {
  async render(params: {
    businessId: string;
    templateKey: AppointmentTemplateKey;
    channel: AppointmentNotificationChannel;
    variables: AppointmentTemplateVariables;
    extras?: Record<string, string>;
  }): Promise<RenderedTemplate> {
    const varMap = buildVariableMap(params.variables, params.extras);

    const custom = await prisma.appointmentMessageTemplate.findFirst({
      where: {
        businessId: params.businessId,
        templateKey: params.templateKey,
        OR: [{ channel: params.channel }, { channel: null }],
        isActive: true,
      },
      orderBy: { channel: 'desc' },
    });

    if (custom) {
      return {
        subject: custom.subject ? substitute(custom.subject, varMap) : undefined,
        body: substitute(custom.body, varMap),
        templateKey: params.templateKey,
        source: 'business',
      };
    }

    const defaultBody = DEFAULT_WHATSAPP[params.templateKey];
  const body = substitute(
      params.channel === 'EMAIL'
        ? defaultBody.replace(/\n/g, '<br />')
        : defaultBody,
      varMap
    );

    return {
      subject:
        params.channel === 'EMAIL'
          ? substitute(DEFAULT_EMAIL_SUBJECT[params.templateKey], varMap)
          : undefined,
      body,
      templateKey: params.templateKey,
      source: 'default',
    };
  }

  async seedDefaultTemplates(businessId: string) {
    const keys = Object.keys(DEFAULT_WHATSAPP) as AppointmentTemplateKey[];
    for (const templateKey of keys) {
      for (const channel of ['WHATSAPP', 'EMAIL'] as AppointmentNotificationChannel[]) {
        await prisma.appointmentMessageTemplate.upsert({
          where: {
            businessId_templateKey_channel: {
              businessId,
              templateKey,
              channel,
            },
          },
          create: {
            businessId,
            templateKey,
            channel,
            name: `${templateKey} (${channel})`,
            subject: channel === 'EMAIL' ? DEFAULT_EMAIL_SUBJECT[templateKey] : null,
            body: DEFAULT_WHATSAPP[templateKey],
          },
          update: {},
        });
      }
    }
  }
}

export const appointmentTemplateService = new AppointmentTemplateService();
