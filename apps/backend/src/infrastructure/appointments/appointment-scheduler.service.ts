import { getReminderQueue } from '../queue/queues';
import type { ReminderInterval } from './appointment-dual-channel.service';
import { logger } from '../../core/logger';

const REMINDER_OFFSETS: Record<'30m' | '20m' | '10m', number> = {
  '30m': 30 * 60 * 1000,
  '20m': 20 * 60 * 1000,
  '10m': 10 * 60 * 1000,
};

const JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 200,
};

export async function cancelAppointmentReminderJobs(appointmentId: string): Promise<void> {
  const queue = getReminderQueue();
  if (!queue) return;

  const jobIds = [
    `${appointmentId}-30m`,
    `${appointmentId}-20m`,
    `${appointmentId}-10m`,
    `${appointmentId}-missed`,
    `${appointmentId}-followup-24h`,
  ];

  await Promise.all(
    jobIds.map(async (jobId) => {
      const job = await queue.getJob(jobId);
      if (job) await job.remove();
    })
  );
}

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

  await cancelAppointmentReminderJobs(params.appointmentId);

  const intervals: Array<'30m' | '20m' | '10m'> = ['30m', '20m', '10m'];

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
      { delay, jobId: `${params.appointmentId}-${interval}`, ...JOB_OPTS }
    );
  }

  const missedDelay = params.startTime.getTime() - Date.now();
  if (missedDelay > 0) {
    await queue.add(
      'missed-check',
      {
        appointmentId: params.appointmentId,
        businessId: params.businessId,
        customerPhone: params.customerPhone,
        interval: 'missed' as ReminderInterval,
      },
      { delay: missedDelay, jobId: `${params.appointmentId}-missed`, ...JOB_OPTS }
    );
  }
}

export async function scheduleMissedFollowUp(params: {
  appointmentId: string;
  businessId: string;
  customerPhone: string;
  missedAt: Date;
}): Promise<void> {
  const queue = getReminderQueue();
  if (!queue) return;

  const fireAt = params.missedAt.getTime() + 24 * 60 * 60 * 1000;
  const delay = fireAt - Date.now();
  if (delay <= 0) return;

  await queue.add(
    'followup-24h',
    {
      appointmentId: params.appointmentId,
      businessId: params.businessId,
      customerPhone: params.customerPhone,
      interval: 'followup-24h' as ReminderInterval,
    },
    { delay, jobId: `${params.appointmentId}-followup-24h`, ...JOB_OPTS }
  );
}
