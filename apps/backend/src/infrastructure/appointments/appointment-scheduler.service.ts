import { getReminderQueue } from '../queue/queues';
import type { ReminderInterval } from './appointment-notification.service';
import { logger } from '../../core/logger';

const REMINDER_OFFSETS: Record<ReminderInterval, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '15m': 15 * 60 * 1000,
};

export async function scheduleAppointmentReminders(params: {
  appointmentId: string;
  businessId: string;
  customerPhone: string;
  startTime: Date;
}): Promise<void> {
  const queue = getReminderQueue();
  if (!queue) {
    logger.warn('Reminder queue unavailable — Redis not configured');
    return;
  }

  const intervals: ReminderInterval[] = ['24h', '1h', '15m'];

  for (const interval of intervals) {
    const fireAt = params.startTime.getTime() - REMINDER_OFFSETS[interval];
    const delay = fireAt - Date.now();
    if (delay <= 0) continue;

    await queue.add(
      `reminder-${interval}`,
      {
        appointmentId: params.appointmentId,
        businessId: params.businessId,
        customerPhone: params.customerPhone,
        interval,
      },
      { delay, jobId: `${params.appointmentId}-${interval}` }
    );
  }

  const missedCheckAt = params.startTime.getTime() + 15 * 60 * 1000;
  const missedDelay = missedCheckAt - Date.now();
  if (missedDelay > 0) {
    await queue.add(
      'missed-check',
      {
        appointmentId: params.appointmentId,
        businessId: params.businessId,
        customerPhone: params.customerPhone,
        interval: 'missed' as const,
      },
      { delay: missedDelay, jobId: `${params.appointmentId}-missed` }
    );
  }
}
