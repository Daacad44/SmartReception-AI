import { getReminderQueue } from '../../infrastructure/queue/queues';
import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../core/logger';

const JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 200,
};

export async function scheduleConfigurableReminders(params: {
  appointmentId: string;
  businessId: string;
  startTime: Date;
}) {
  const queue = getReminderQueue();
  if (!queue) {
    logger.warn('Reminder queue unavailable — configurable reminders skipped');
    return;
  }

  const configs = await prisma.appointmentReminderConfig.findMany({
    where: { businessId: params.businessId, isEnabled: true },
    orderBy: { sortOrder: 'asc' },
  });

  for (const config of configs) {
    const fireAt = params.startTime.getTime() + config.offsetMinutes * 60 * 1000;
    const delay = fireAt - Date.now();
    if (delay <= 0) continue;

    const jobId = `${params.appointmentId}-cfg-${config.id}`;
    const existing = await queue.getJob(jobId);
    if (existing) await existing.remove();

    await queue.add(
      'configurable-reminder',
      {
        appointmentId: params.appointmentId,
        businessId: params.businessId,
        configId: config.id,
        label: config.label,
        channels: config.channels,
      },
      { delay, jobId, ...JOB_OPTS }
    );
  }
}

export async function cancelConfigurableReminders(appointmentId: string, businessId: string) {
  const queue = getReminderQueue();
  if (!queue) return;

  const configs = await prisma.appointmentReminderConfig.findMany({
    where: { businessId },
    select: { id: true },
  });

  await Promise.all(
    configs.map(async (config) => {
      const job = await queue.getJob(`${appointmentId}-cfg-${config.id}`);
      if (job) await job.remove();
    })
  );
}
