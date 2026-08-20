import { Prisma } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../core/logger';
import { prisma } from '../../infrastructure/database/prisma';
import { emailService } from '../../infrastructure/email/email.service';
import * as templates from '../../infrastructure/email/templates';
import { createNotification } from '../../infrastructure/notifications/notification-helper';

// Businesses without an active subscription fall back to this conservative
// monthly AI-message allowance so cost can never run away un-metered.
const DEFAULT_MESSAGE_LIMIT = 100;

// Threshold percentages that trigger a one-off notification per billing period.
const WARNING_THRESHOLD = 80;
const BLOCK_THRESHOLD = 100;

export interface MonthlyMessageUsage {
  used: number;
  limit: number;
  percent: number;
  periodStart: Date;
  blocked: boolean;
  planName: string;
}

/**
 * Start of the current billing period — calendar month, UTC. Counting
 * AiUsageEvent rows with createdAt >= periodStart makes the monthly reset
 * automatic (a new month simply moves the window), with no stored counter.
 */
export function getPeriodStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Current monthly AI-message usage vs the plan limit. The counter is the SAME
 * AiUsageEvent table that already drives cost/analytics — one row per billable
 * AI reply (operation='chat') — so there is no parallel counter to drift.
 */
export async function getMonthlyMessageUsage(businessId: string): Promise<MonthlyMessageUsage> {
  const periodStart = getPeriodStart();

  const [subscription, used] = await Promise.all([
    prisma.businessSubscription.findUnique({
      where: { businessId },
      include: { plan: true },
    }),
    prisma.aiUsageEvent.count({
      where: {
        businessId,
        operation: 'chat',
        createdAt: { gte: periodStart },
      },
    }),
  ]);

  const limit = subscription?.plan?.maxConversations ?? DEFAULT_MESSAGE_LIMIT;
  const planName = subscription?.plan?.name ?? 'Default';
  const safeLimit = limit > 0 ? limit : 1;
  const percent = Math.min(100, Math.round((used / safeLimit) * 100));

  return {
    used,
    limit,
    percent,
    periodStart,
    blocked: used >= limit,
    planName,
  };
}

/**
 * Fire the 80% / 100% threshold notifications at most once per business per
 * billing period. Dedup is enforced by the MessageUsageAlert unique constraint
 * (businessId, periodStart, threshold): the create() succeeds exactly once, so
 * even under concurrent inbound messages only the first caller notifies.
 *
 * Safe to call fire-and-forget on every inbound message.
 */
export async function maybeNotifyUsageThresholds(
  businessId: string,
  usage: MonthlyMessageUsage
): Promise<void> {
  try {
    const threshold =
      usage.used >= usage.limit
        ? BLOCK_THRESHOLD
        : usage.percent >= WARNING_THRESHOLD
          ? WARNING_THRESHOLD
          : null;

    if (threshold === null) return;

    // Atomic "claim" of this threshold for this period. If it already exists we
    // have notified before → skip. This is the single dedup gate.
    try {
      await prisma.messageUsageAlert.create({
        data: { businessId, periodStart: usage.periodStart, threshold },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return; // already notified this threshold this period
      }
      throw error;
    }

    await dispatchThresholdNotifications(businessId, threshold as 80 | 100, usage);
  } catch (error) {
    logger.warn('Failed to process message-usage threshold notification', { businessId, error });
  }
}

async function dispatchThresholdNotifications(
  businessId: string,
  threshold: 80 | 100,
  usage: MonthlyMessageUsage
): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, email: true },
  });
  if (!business) return;

  const isBlock = threshold === BLOCK_THRESHOLD;
  const usedStr = usage.used.toLocaleString();
  const limitStr = usage.limit.toLocaleString();

  const inAppTitle = isBlock
    ? 'Monthly AI message limit reached'
    : `${threshold}% of monthly AI messages used`;
  const inAppMessage = isBlock
    ? `AI auto-replies are paused (${usedStr}/${limitStr} used). Customers now get a "please contact us" message; upgrade the plan or wait for the new billing period to restore AI.`
    : `You have used ${usedStr}/${limitStr} AI messages this billing period. AI auto-replies pause at 100%.`;

  const businessActionUrl = `${config.frontendUrl}/settings/subscription`;
  const adminActionUrl = `${config.frontendUrl}/admin/subscriptions/${businessId}`;

  // ── Business: in-app + email ──────────────────────────────────────────────
  await createNotification({
    businessId,
    type: 'BILLING',
    title: inAppTitle,
    message: inAppMessage,
    data: { threshold, used: usage.used, limit: usage.limit, kind: 'message_usage' },
  });

  if (business.email) {
    const { subject, html } = templates.messageUsageAlertEmail({
      audience: 'business',
      threshold,
      businessName: business.name,
      planName: usage.planName,
      used: usage.used,
      limit: usage.limit,
      actionUrl: businessActionUrl,
    });
    await emailService.send(business.email, subject, html).catch((error) => {
      logger.warn('Failed to send business usage-alert email', { businessId, error });
    });
  }

  // ── Super admins: in-app + email ──────────────────────────────────────────
  const superAdmins = await prisma.user.findMany({
    where: { isSuperAdmin: true, isActive: true },
    select: { id: true, email: true },
  });

  for (const admin of superAdmins) {
    await createNotification({
      businessId,
      userId: admin.id,
      type: 'BILLING',
      title: isBlock
        ? `${business.name}: AI message limit reached`
        : `${business.name}: ${threshold}% of AI messages used`,
      message: `${business.name} — ${usedStr}/${limitStr} AI messages this period (${usage.planName} plan).`,
      data: { threshold, businessId, used: usage.used, limit: usage.limit, kind: 'message_usage' },
    });

    if (admin.email) {
      const { subject, html } = templates.messageUsageAlertEmail({
        audience: 'admin',
        threshold,
        businessName: business.name,
        planName: usage.planName,
        used: usage.used,
        limit: usage.limit,
        actionUrl: adminActionUrl,
      });
      await emailService.send(admin.email, subject, html).catch((error) => {
        logger.warn('Failed to send admin usage-alert email', { businessId, adminId: admin.id, error });
      });
    }
  }

  logger.info('Message-usage threshold notification sent', {
    businessId,
    threshold,
    used: usage.used,
    limit: usage.limit,
  });
}
