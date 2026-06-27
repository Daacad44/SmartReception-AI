import type { SubscriptionNotificationType } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { subscriptionRepository } from './subscription.repository';
import { REMINDER_OFFSETS_MS } from './subscription.types';

const REMINDER_TYPES = Object.keys(REMINDER_OFFSETS_MS) as SubscriptionNotificationType[];

export async function scheduleSubscriptionReminders(businessSubscriptionId: string): Promise<void> {
  const sub = await prisma.businessSubscription.findUnique({
    where: { id: businessSubscriptionId },
    include: { business: true },
  });
  if (!sub?.expiresAt) return;

  await prisma.subscriptionNotification.deleteMany({
    where: {
      businessSubscriptionId,
      status: 'PENDING',
      type: { in: REMINDER_TYPES },
    },
  });

  const expiresAt = sub.expiresAt.getTime();
  const now = Date.now();

  for (const type of REMINDER_TYPES) {
    const offset = REMINDER_OFFSETS_MS[type]!;
    const scheduledFor = new Date(expiresAt - offset);
    if (scheduledFor.getTime() <= now) continue;

    for (const channel of ['EMAIL', 'WHATSAPP', 'IN_APP'] as const) {
      await subscriptionRepository.createNotification({
        business: { connect: { id: sub.businessId } },
        businessSubscription: { connect: { id: sub.id } },
        channel,
        type,
        scheduledFor,
      });
    }
  }
}

export async function processDueReminders(): Promise<number> {
  const due = await subscriptionRepository.findPendingNotifications(new Date());
  if (!due.length) return 0;

  const { sendSubscriptionReminder } = await import('./subscription-notification.service');
  let sent = 0;

  for (const notification of due) {
    try {
      await sendSubscriptionReminder(notification);
      sent++;
    } catch {
      // logged in notification service
    }
  }

  return sent;
}

export async function processExpiredSubscriptions(): Promise<number> {
  const expired = await subscriptionRepository.listExpiringSubscriptions(new Date());
  if (!expired.length) return 0;

  const { subscriptionService } = await import('./subscription.service');
  let count = 0;

  for (const sub of expired) {
    if (!sub.expiresAt || sub.expiresAt > new Date()) continue;
    await subscriptionService.expireSubscription(sub.businessId);
    count++;
  }

  return count;
}
