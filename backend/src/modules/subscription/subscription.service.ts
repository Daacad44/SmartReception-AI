import type { BusinessLicenseStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { ValidationError, NotFoundError } from '../../core/errors';
import { subscriptionRepository } from './subscription.repository';
import {
  DURATION_PRESET_DAYS,
  calculateSubscriptionDates,
  type AssignSubscriptionInput,
  type SubscriptionActorContext,
} from './subscription.types';
import { scheduleSubscriptionReminders } from './subscription-scheduler.service';
import { getBusinessUsageSnapshot } from './subscription-usage.service';

function resolveDurationDays(
  preset: AssignSubscriptionInput['durationPreset'],
  customDays?: number
): number {
  if (preset === 'CUSTOM') {
    if (!customDays || customDays < 1) {
      throw new ValidationError('Custom duration requires at least 1 day');
    }
    return customDays;
  }
  return DURATION_PRESET_DAYS[preset];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export class SubscriptionService {
  async getTenantLicenseStatus(businessId: string) {
    const business = await subscriptionRepository.getBusinessLicense(businessId);
    if (!business) throw new NotFoundError('Business not found');

    const sub = business.businessSubscription;
    const expiresAt = sub?.expiresAt ?? null;
    const now = Date.now();
    const daysExpired =
      expiresAt && expiresAt.getTime() < now
        ? Math.ceil((now - expiresAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    return {
      businessId: business.id,
      businessName: business.name,
      status: business.licenseStatus,
      isLocked: business.isLicenseLocked,
      plan: sub?.plan ? { code: sub.plan.code, name: sub.plan.name } : null,
      activatedAt: sub?.activatedAt?.toISOString() ?? null,
      expiresAt: expiresAt?.toISOString() ?? null,
      daysExpired,
      isPaused: sub?.isPaused ?? false,
      paymentStatus: sub?.paymentStatus ?? 'NOT_APPLICABLE',
      remainingTime: expiresAt ? Math.max(0, expiresAt.getTime() - now) : null,
    };
  }

  async assignSubscription(input: AssignSubscriptionInput, actor: SubscriptionActorContext) {
    const business = await subscriptionRepository.getBusinessLicense(input.businessId);
    if (!business) throw new NotFoundError('Business not found');

    const plan = await subscriptionRepository.getPlanByCode(input.planCode);
    if (!plan) throw new ValidationError('Invalid subscription plan');

    const calc = calculateSubscriptionDates({
      startDate: input.activationDate ?? new Date(),
      durationPreset: input.durationPreset,
      customDurationDays: input.customDurationDays,
      endDate: input.endDate,
      isTrial: input.isTrial,
    });

    const status = calc.status;
    const old = business.businessSubscription;

    const subscription = await prisma.$transaction(async (tx) => {
      const existing = await tx.businessSubscription.findUnique({
        where: { businessId: input.businessId },
      });

      const sub = await tx.businessSubscription.upsert({
        where: { businessId: input.businessId },
        create: {
          businessId: input.businessId,
          planId: plan.id,
          previousPlanId: existing?.planId ?? null,
          status,
          durationPreset: input.durationPreset,
          durationDays: calc.durationDays,
          activatedAt: calc.startDate,
          expiresAt: calc.endDate,
          isPaused: false,
          isTrial: input.isTrial ?? false,
          pausedAt: null,
          cancelledAt: null,
          lockedAt: null,
          internalNotes: input.internalNotes,
          paymentStatus: input.paymentStatus ?? 'NOT_APPLICABLE',
          paymentMethod: input.paymentMethod ?? null,
          referenceNumber: input.referenceNumber ?? null,
          invoiceNumber: input.invoiceNumber ?? null,
          lastPaymentAt: input.paymentStatus === 'PAID' ? new Date() : null,
          nextRenewalAt: calc.endDate,
          assignedById: actor.userId,
        },
        update: {
          planId: plan.id,
          previousPlanId: existing?.planId ?? null,
          status,
          durationPreset: input.durationPreset,
          durationDays: calc.durationDays,
          activatedAt: calc.startDate,
          expiresAt: calc.endDate,
          isPaused: false,
          isTrial: input.isTrial ?? false,
          pausedAt: null,
          cancelledAt: null,
          lockedAt: null,
          internalNotes: input.internalNotes,
          paymentStatus: input.paymentStatus ?? 'NOT_APPLICABLE',
          paymentMethod: input.paymentMethod ?? null,
          referenceNumber: input.referenceNumber ?? null,
          invoiceNumber: input.invoiceNumber ?? null,
          lastPaymentAt: input.paymentStatus === 'PAID' ? new Date() : null,
          nextRenewalAt: calc.endDate,
          assignedById: actor.userId,
        },
        include: { plan: true },
      });

      await tx.business.update({
        where: { id: input.businessId },
        data: { licenseStatus: status, isLicenseLocked: false },
      });

      await tx.subscriptionHistory.create({
        data: {
          businessSubscriptionId: sub.id,
          businessId: input.businessId,
          planId: plan.id,
          status,
          activatedAt: calc.startDate,
          expiresAt: calc.endDate,
          action: 'ASSIGNED',
          performedById: actor.userId,
          reason: input.reason,
          metadata: {
            durationDays: calc.durationDays,
            durationPreset: input.durationPreset,
            paymentStatus: input.paymentStatus,
            paymentMethod: input.paymentMethod,
          },
        },
      });

      if (input.amount && input.amount > 0) {
        const payment = await tx.subscriptionPayment.create({
          data: {
            businessId: input.businessId,
            businessSubscriptionId: sub.id,
            amount: input.amount,
            status: input.paymentStatus ?? 'PENDING',
            paymentMethod: input.paymentMethod ?? null,
            referenceNumber: input.referenceNumber ?? null,
            invoiceNumber: input.invoiceNumber ?? null,
            paidAt: input.paymentStatus === 'PAID' ? new Date() : null,
            recordedById: actor.userId,
            notes: input.reason,
          },
        });

        await tx.subscriptionTransaction.create({
          data: {
            businessId: input.businessId,
            paymentId: payment.id,
            type: 'PAYMENT',
            amount: input.amount,
            status: input.paymentStatus === 'PAID' ? 'COMPLETED' : 'PENDING',
            provider: input.paymentMethod ?? 'MANUAL',
            providerRef: input.referenceNumber ?? undefined,
          },
        });
      }

      return sub;
    });

    await subscriptionRepository.syncLegacySubscription(
      input.businessId,
      plan.code,
      subscription.expiresAt!
    );

    await subscriptionRepository.logAction({
      businessId: input.businessId,
      businessSubscriptionId: subscription.id,
      action: 'ASSIGNED',
      performedById: actor.userId,
      performedByEmail: actor.email,
      ipAddress: actor.ipAddress,
      oldValue: old
        ? {
            status: old.status,
            expiresAt: old.expiresAt,
            planCode: old.plan?.code,
          }
        : undefined,
      newValue: {
        status,
        expiresAt: calc.endDate,
        planCode: plan.code,
        durationDays: calc.durationDays,
        remainingDays: calc.remainingDays,
      },
      notes: input.reason,
    });

    await scheduleSubscriptionReminders(subscription.id);
    return this.getAdminBusinessDetail(input.businessId);
  }

  async extendSubscription(
    businessId: string,
    additionalDays: number,
    actor: SubscriptionActorContext,
    reason?: string
  ) {
    if (additionalDays < 1) throw new ValidationError('Extension must be at least 1 day');
    const sub = await subscriptionRepository.getBusinessSubscription(businessId);
    if (!sub?.expiresAt) throw new NotFoundError('No active subscription to extend');

    const oldExpires = sub.expiresAt;
    const expiresAt = addDays(sub.expiresAt, additionalDays);
    const status: BusinessLicenseStatus =
      sub.status === 'EXPIRED' || sub.status === 'SUSPENDED' ? 'ACTIVE' : sub.status;

    const updated = await subscriptionRepository.upsertBusinessSubscription(businessId, {
      businessId,
      planId: sub.planId,
      status,
      durationPreset: sub.durationPreset,
      durationDays: (sub.durationDays ?? 0) + additionalDays,
      activatedAt: sub.activatedAt,
      expiresAt,
      isPaused: false,
      pausedAt: null,
      cancelledAt: sub.cancelledAt,
      internalNotes: sub.internalNotes,
      paymentStatus: sub.paymentStatus,
      assignedById: sub.assignedById,
    });

    await subscriptionRepository.updateBusinessLicense(businessId, status, false);
    await subscriptionRepository.syncLegacySubscription(businessId, updated.plan.code, expiresAt);

    await subscriptionRepository.createRenewal({
      businessSubscriptionId: updated.id,
      previousExpiresAt: oldExpires,
      newExpiresAt: expiresAt,
      renewedById: actor.userId,
      reason,
    });

    await subscriptionRepository.logAction({
      businessId,
      businessSubscriptionId: updated.id,
      action: 'EXTENDED',
      performedById: actor.userId,
      performedByEmail: actor.email,
      ipAddress: actor.ipAddress,
      oldValue: { expiresAt: oldExpires },
      newValue: { expiresAt, additionalDays },
      notes: reason,
    });

    await scheduleSubscriptionReminders(updated.id);
    return this.getAdminBusinessDetail(businessId);
  }

  async shortenSubscription(
    businessId: string,
    reduceDays: number,
    actor: SubscriptionActorContext,
    reason?: string
  ) {
    if (reduceDays < 1) throw new ValidationError('Reduction must be at least 1 day');
    const sub = await subscriptionRepository.getBusinessSubscription(businessId);
    if (!sub?.expiresAt) throw new NotFoundError('No subscription to shorten');

    const oldExpires = sub.expiresAt;
    const expiresAt = addDays(sub.expiresAt, -reduceDays);
    const updated = await subscriptionRepository.upsertBusinessSubscription(businessId, {
      businessId,
      planId: sub.planId,
      status: sub.status,
      durationPreset: sub.durationPreset,
      durationDays: Math.max(1, (sub.durationDays ?? 1) - reduceDays),
      activatedAt: sub.activatedAt,
      expiresAt,
      isPaused: sub.isPaused,
      pausedAt: sub.pausedAt,
      cancelledAt: sub.cancelledAt,
      internalNotes: sub.internalNotes,
      paymentStatus: sub.paymentStatus,
      assignedById: sub.assignedById,
    });

    await subscriptionRepository.syncLegacySubscription(businessId, updated.plan.code, expiresAt);
    await subscriptionRepository.logAction({
      businessId,
      businessSubscriptionId: updated.id,
      action: 'SHORTENED',
      performedById: actor.userId,
      performedByEmail: actor.email,
      ipAddress: actor.ipAddress,
      oldValue: { expiresAt: oldExpires },
      newValue: { expiresAt, reduceDays },
      notes: reason,
    });

    await scheduleSubscriptionReminders(updated.id);
    return this.getAdminBusinessDetail(businessId);
  }

  async setStatus(
    businessId: string,
    status: BusinessLicenseStatus,
    actor: SubscriptionActorContext,
    action: 'SUSPENDED' | 'REACTIVATED' | 'CANCELLED' | 'EXPIRED' | 'UNLOCKED' | 'LOCKED',
    notes?: string
  ) {
    const sub = await subscriptionRepository.getBusinessSubscription(businessId);
    if (!sub) throw new NotFoundError('Subscription not found');

    const isLocked = ['EXPIRED', 'SUSPENDED', 'CANCELLED', 'PENDING', 'LOCKED'].includes(status);
    const updated = await subscriptionRepository.upsertBusinessSubscription(businessId, {
      businessId,
      planId: sub.planId,
      status,
      durationPreset: sub.durationPreset,
      durationDays: sub.durationDays,
      activatedAt: sub.activatedAt,
      expiresAt: sub.expiresAt,
      isPaused: status === 'SUSPENDED',
      isTrial: sub.isTrial,
      pausedAt: status === 'SUSPENDED' ? new Date() : null,
      cancelledAt: status === 'CANCELLED' ? new Date() : sub.cancelledAt,
      lockedAt: status === 'LOCKED' ? new Date() : status === 'ACTIVE' || status === 'TRIAL' ? null : sub.lockedAt,
      internalNotes: sub.internalNotes,
      paymentStatus: sub.paymentStatus,
      paymentMethod: sub.paymentMethod,
      referenceNumber: sub.referenceNumber,
      invoiceNumber: sub.invoiceNumber,
      lastPaymentAt: sub.lastPaymentAt,
      nextRenewalAt: sub.nextRenewalAt,
      assignedById: sub.assignedById,
    });

    await subscriptionRepository.updateBusinessLicense(businessId, status, isLocked);

    if (status === 'ACTIVE' || status === 'TRIAL') {
      await subscriptionRepository.syncLegacySubscription(
        businessId,
        updated.plan.code,
        updated.expiresAt ?? new Date()
      );
    } else {
      await prisma.subscription.updateMany({
        where: { businessId },
        data: { status: status === 'EXPIRED' ? 'EXPIRED' : 'CANCELLED' },
      });
    }

    await subscriptionRepository.logAction({
      businessId,
      businessSubscriptionId: updated.id,
      action,
      performedById: actor.userId,
      performedByEmail: actor.email,
      ipAddress: actor.ipAddress,
      oldValue: { status: sub.status },
      newValue: { status },
      notes,
    });

    return this.getAdminBusinessDetail(businessId);
  }

  async changePlan(
    businessId: string,
    planCode: AssignSubscriptionInput['planCode'],
    actor: SubscriptionActorContext,
    direction: 'UPGRADED' | 'DOWNGRADED',
    reason?: string
  ) {
    const sub = await subscriptionRepository.getBusinessSubscription(businessId);
    if (!sub) throw new NotFoundError('Subscription not found');
    const plan = await subscriptionRepository.getPlanByCode(planCode);
    if (!plan) throw new ValidationError('Invalid plan');

    const updated = await subscriptionRepository.upsertBusinessSubscription(businessId, {
      businessId,
      planId: plan.id,
      status: sub.status,
      durationPreset: sub.durationPreset,
      durationDays: sub.durationDays,
      activatedAt: sub.activatedAt,
      expiresAt: sub.expiresAt,
      isPaused: sub.isPaused,
      pausedAt: sub.pausedAt,
      cancelledAt: sub.cancelledAt,
      internalNotes: sub.internalNotes,
      paymentStatus: sub.paymentStatus,
      assignedById: sub.assignedById,
    });

    if (sub.expiresAt) {
      await subscriptionRepository.syncLegacySubscription(businessId, plan.code, sub.expiresAt);
    }

    await subscriptionRepository.logAction({
      businessId,
      businessSubscriptionId: updated.id,
      action: direction,
      performedById: actor.userId,
      performedByEmail: actor.email,
      ipAddress: actor.ipAddress,
      oldValue: { planCode: sub.plan.code },
      newValue: { planCode: plan.code },
      notes: reason,
    });

    return this.getAdminBusinessDetail(businessId);
  }

  async addNote(businessId: string, note: string, actor: SubscriptionActorContext) {
    const sub = await subscriptionRepository.getBusinessSubscription(businessId);
    if (!sub) throw new NotFoundError('Subscription not found');

    const internalNotes = [sub.internalNotes, `[${new Date().toISOString()}] ${note}`]
      .filter(Boolean)
      .join('\n');

    await subscriptionRepository.upsertBusinessSubscription(businessId, {
      businessId,
      planId: sub.planId,
      status: sub.status,
      durationPreset: sub.durationPreset,
      durationDays: sub.durationDays,
      activatedAt: sub.activatedAt,
      expiresAt: sub.expiresAt,
      isPaused: sub.isPaused,
      pausedAt: sub.pausedAt,
      cancelledAt: sub.cancelledAt,
      internalNotes,
      paymentStatus: sub.paymentStatus,
      assignedById: sub.assignedById,
    });

    await subscriptionRepository.logAction({
      businessId,
      businessSubscriptionId: sub.id,
      action: 'NOTE_ADDED',
      performedById: actor.userId,
      performedByEmail: actor.email,
      ipAddress: actor.ipAddress,
      notes: note,
    });

    return this.getAdminBusinessDetail(businessId);
  }

  async expireSubscription(businessId: string, actorId?: string) {
    const sub = await subscriptionRepository.getBusinessSubscription(businessId);
    if (!sub || sub.status === 'EXPIRED') return;

    await subscriptionRepository.upsertBusinessSubscription(businessId, {
      businessId,
      planId: sub.planId,
      status: 'EXPIRED',
      durationPreset: sub.durationPreset,
      durationDays: sub.durationDays,
      activatedAt: sub.activatedAt,
      expiresAt: sub.expiresAt,
      isPaused: sub.isPaused,
      pausedAt: sub.pausedAt,
      cancelledAt: sub.cancelledAt,
      internalNotes: sub.internalNotes,
      paymentStatus: sub.paymentStatus,
      assignedById: sub.assignedById,
    });

    await subscriptionRepository.updateBusinessLicense(businessId, 'EXPIRED', true);
    await prisma.subscription.updateMany({
      where: { businessId },
      data: { status: 'EXPIRED' },
    });

    await subscriptionRepository.logAction({
      businessId,
      businessSubscriptionId: sub.id,
      action: 'EXPIRED',
      performedById: actorId,
      oldValue: { status: sub.status },
      newValue: { status: 'EXPIRED' },
    });
  }

  async listAdminSubscriptions(params: {
    page: number;
    limit: number;
    search?: string;
    status?: BusinessLicenseStatus;
    planCode?: AssignSubscriptionInput['planCode'];
  }) {
    const result = await subscriptionRepository.listBusinessSubscriptions(params);
    return {
      data: result.data.map((b) => ({
        id: b.id,
        name: b.name,
        email: b.email,
        licenseStatus: b.licenseStatus,
        isLicenseLocked: b.isLicenseLocked,
        isActive: b.isActive,
        memberCount: b._count.members,
        customerCount: b._count.customers,
        subscription: b.businessSubscription
          ? {
              id: b.businessSubscription.id,
              status: b.businessSubscription.status,
              plan: {
                code: b.businessSubscription.plan.code,
                name: b.businessSubscription.plan.name,
              },
              activatedAt: b.businessSubscription.activatedAt?.toISOString() ?? null,
              expiresAt: b.businessSubscription.expiresAt?.toISOString() ?? null,
              isPaused: b.businessSubscription.isPaused,
              paymentStatus: b.businessSubscription.paymentStatus,
              internalNotes: b.businessSubscription.internalNotes,
            }
          : null,
      })),
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  async getAdminBusinessDetail(businessId: string) {
    const business = await subscriptionRepository.getBusinessLicense(businessId);
    if (!business) throw new NotFoundError('Business not found');

    const [history, activity, notifications, payments, usage] = await Promise.all([
      subscriptionRepository.listHistory(businessId),
      subscriptionRepository.listActivityLogs(businessId),
      subscriptionRepository.listNotifications(businessId),
      subscriptionRepository.listPayments(businessId),
      getBusinessUsageSnapshot(businessId),
    ]);

    const sub = business.businessSubscription;
    const owner = business.members[0]?.user ?? null;
    const now = Date.now();
    const remainingDays = sub?.expiresAt
      ? Math.max(0, Math.ceil((sub.expiresAt.getTime() - now) / (1000 * 60 * 60 * 24)))
      : 0;

    return {
      business: {
        id: business.id,
        name: business.name,
        email: business.email,
        phone: business.phone,
        licenseStatus: business.licenseStatus,
        isLicenseLocked: business.isLicenseLocked,
        isActive: business.isActive,
        owner: owner
          ? {
              id: owner.id,
              name: `${owner.firstName} ${owner.lastName}`.trim(),
              email: owner.email,
            }
          : null,
        subscription: sub
          ? {
              id: sub.id,
              status: sub.status,
              plan: {
                code: sub.plan.code,
                name: sub.plan.name,
                monthlyPrice: Number(sub.plan.monthlyPrice),
                yearlyPrice: Number(sub.plan.yearlyPrice),
                limits: {
                  maxUsers: sub.plan.maxUsers,
                  maxConversations: sub.plan.maxConversations,
                  maxWhatsappNumbers: sub.plan.maxWhatsappNumbers,
                  maxAiAgents: sub.plan.maxAiAgents,
                  storageLimitMb: sub.plan.storageLimitMb,
                  knowledgeBaseLimit: sub.plan.knowledgeBaseLimit,
                  teamLimit: sub.plan.teamLimit,
                  campaignLimit: sub.plan.campaignLimit,
                  appointmentLimit: sub.plan.appointmentLimit,
                },
                featureFlags: sub.plan.featureFlags,
              },
              activatedAt: sub.activatedAt?.toISOString() ?? null,
              expiresAt: sub.expiresAt?.toISOString() ?? null,
              remainingDays,
              isPaused: sub.isPaused,
              isTrial: sub.isTrial,
              paymentStatus: sub.paymentStatus,
              paymentMethod: sub.paymentMethod,
              referenceNumber: sub.referenceNumber,
              invoiceNumber: sub.invoiceNumber,
              lastPaymentAt: sub.lastPaymentAt?.toISOString() ?? null,
              nextRenewalAt: sub.nextRenewalAt?.toISOString() ?? null,
              internalNotes: sub.internalNotes,
            }
          : null,
      },
      usage,
      payments,
      history,
      activity,
      notifications,
    };
  }

  async lockSubscription(businessId: string, actor: SubscriptionActorContext, reason?: string) {
    return this.setStatus(businessId, 'LOCKED', actor, 'LOCKED', reason ?? 'Locked by super admin');
  }

  async calculatePreview(input: {
    activationDate?: string;
    durationPreset: AssignSubscriptionInput['durationPreset'];
    customDurationDays?: number;
    endDate?: string;
    isTrial?: boolean;
  }) {
    const calc = calculateSubscriptionDates({
      startDate: input.activationDate ? new Date(input.activationDate) : new Date(),
      durationPreset: input.durationPreset,
      customDurationDays: input.customDurationDays,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      isTrial: input.isTrial,
    });
    return {
      startDate: calc.startDate.toISOString(),
      endDate: calc.endDate.toISOString(),
      durationDays: calc.durationDays,
      remainingDays: calc.remainingDays,
      status: calc.status,
    };
  }

  async listPlans() {
    return subscriptionRepository.listPlans();
  }
}

export const subscriptionService = new SubscriptionService();
