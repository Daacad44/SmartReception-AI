import type { SubscriptionNotification } from '@prisma/client';
import { emailService } from '../../infrastructure/email/email.service';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { prisma } from '../../infrastructure/database/prisma';
import { resolveStoredToken } from '../../infrastructure/crypto/token-crypto';
import { logger } from '../../core/logger';
import { formatRemainingTime } from './subscription-license.service';
import { subscriptionRepository } from './subscription.repository';
import { notifyBilling } from '../../infrastructure/notifications/notification-helper';

function buildReminderMessage(businessName: string, expiresAt: Date | null): string {
  const remaining = formatRemainingTime(expiresAt);
  return `Hello ${businessName}

Your SmartReception AI subscription will expire in:
${remaining}

Please renew your subscription to avoid service interruption.

Thank you.`;
}

export async function sendSubscriptionReminder(
  notification: SubscriptionNotification & {
    business: { name: string; email: string | null; phone: string | null };
    businessSubscription: { expiresAt: Date | null; plan: { name: string } };
  }
): Promise<void> {
  const message = buildReminderMessage(
    notification.business.name,
    notification.businessSubscription.expiresAt
  );

  try {
    if (notification.channel === 'EMAIL') {
      const to = notification.business.email;
      if (!to) {
        await subscriptionRepository.markNotificationFailed(notification.id, 'No business email');
        return;
      }
      await emailService.send(
        to,
        'SmartReception AI — Subscription Reminder',
        `<pre style="font-family: sans-serif; white-space: pre-wrap;">${message}</pre>`
      );
    } else if (notification.channel === 'WHATSAPP') {
      const account = await prisma.whatsAppAccount.findFirst({
        where: { businessId: notification.businessId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      const phone = notification.business.phone;
      if (!account || !phone) {
        await subscriptionRepository.markNotificationFailed(
          notification.id,
          'No WhatsApp account or business phone'
        );
        return;
      }

      await whatsappService.sendOutbound({
        phoneNumberId: account.phoneNumberId,
        to: phone,
        accessToken: resolveStoredToken(account.accessToken),
        type: 'TEXT',
        content: message,
      });
    } else if (notification.channel === 'IN_APP') {
      await notifyBilling(
        notification.businessId,
        'Subscription Reminder',
        `Your subscription expires in ${formatRemainingTime(notification.businessSubscription.expiresAt)}.`
      );
    } else {
      await subscriptionRepository.markNotificationFailed(
        notification.id,
        `Channel ${notification.channel} not yet implemented`
      );
      return;
    }

    await subscriptionRepository.markNotificationSent(notification.id, message);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.warn('Subscription reminder failed', { notificationId: notification.id, detail });
    await subscriptionRepository.markNotificationFailed(notification.id, detail);
    throw error;
  }
}
