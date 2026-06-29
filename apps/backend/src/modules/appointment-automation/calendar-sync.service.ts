import QRCode from 'qrcode';
import { prisma } from '../../infrastructure/database/prisma';
import type { AppointmentWorkflowEventType } from '@prisma/client';
import type { AppointmentTemplateVariables } from './types';

export class AppointmentCalendarSyncService {
  generateIcs(variables: AppointmentTemplateVariables, start: Date, end: Date, uid: string): string {
    const format = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SmartReception//Appointment Automation//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${format(new Date())}`,
      `DTSTART:${format(start)}`,
      `DTEND:${format(end)}`,
      `SUMMARY:${variables.service} - ${variables.businessName}`,
      `DESCRIPTION:Booking ${variables.bookingNumber} with ${variables.assignedEmployee}`,
      `LOCATION:${variables.location}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  buildCalendarLinks(variables: AppointmentTemplateVariables, start: Date, end: Date) {
    const title = encodeURIComponent(`${variables.service} - ${variables.businessName}`);
    const details = encodeURIComponent(`Booking ${variables.bookingNumber}`);
    const location = encodeURIComponent(variables.location);
    const startIso = start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const endIso = end.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

    return {
      googleCalendarLink: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`,
      outlookCalendarLink: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&body=${details}&startdt=${start.toISOString()}&enddt=${end.toISOString()}&location=${location}`,
      appleCalendarLink: `data:text/calendar;charset=utf8,${encodeURIComponent(this.generateIcs(variables, start, end, variables.bookingNumber))}`,
    };
  }

  async generateQrCode(payload: string): Promise<string> {
    return QRCode.toDataURL(payload, { margin: 1, width: 256 });
  }
}

export const appointmentCalendarSyncService = new AppointmentCalendarSyncService();
