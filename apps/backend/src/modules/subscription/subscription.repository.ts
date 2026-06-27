import {
  BusinessLicenseStatus,
  SubscriptionActivityAction,
  SubscriptionPlan,
  type Prisma,
} from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';

export class SubscriptionRepository {
  async listPlans() {
    return prisma.subscriptionPlanCatalog.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getPlanByCode(code: SubscriptionPlan) {
    return prisma.subscriptionPlanCatalog.findUnique({ where: { code } });
  }

  async getBusinessSubscription(businessId: string) {
    return prisma.businessSubscription.findUnique({
      where: { businessId },
      include: {
        plan: true,
        assignedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async getBusinessLicense(businessId: string) {
    return prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        licenseStatus: true,
        isLicenseLocked: true,
        isActive: true,
        businessSubscription: { include: { plan: true } },
      },
    });
  }

  async listBusinessSubscriptions(params: {
    page: number;
    limit: number;
    search?: string;
    status?: BusinessLicenseStatus;
    planCode?: SubscriptionPlan;
  }) {
    const { page, limit, search, status, planCode } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.BusinessWhereInput = {
      ...(status && { licenseStatus: status }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(planCode && {
        businessSubscription: { plan: { code: planCode } },
      }),
    };

    const [data, total] = await Promise.all([
      prisma.business.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          businessSubscription: { include: { plan: true } },
          _count: { select: { members: true, customers: true } },
        },
      }),
      prisma.business.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createHistory(data: Prisma.SubscriptionHistoryCreateInput) {
    return prisma.subscriptionHistory.create({ data });
  }

  async upsertBusinessSubscription(
    businessId: string,
    data: Prisma.BusinessSubscriptionUncheckedCreateInput
  ) {
    return prisma.businessSubscription.upsert({
      where: { businessId },
      create: data,
      update: data,
      include: { plan: true },
    });
  }

  async updateBusinessLicense(
    businessId: string,
    licenseStatus: BusinessLicenseStatus,
    isLicenseLocked: boolean
  ) {
    return prisma.business.update({
      where: { id: businessId },
      data: { licenseStatus, isLicenseLocked },
    });
  }

  async syncLegacySubscription(businessId: string, planCode: SubscriptionPlan, expiresAt: Date) {
    const now = new Date();
    await prisma.subscription.upsert({
      where: { businessId },
      create: {
        businessId,
        plan: planCode,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: expiresAt,
      },
      update: {
        plan: planCode,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: expiresAt,
      },
    });
  }

  async listExpiringSubscriptions(before: Date) {
    return prisma.businessSubscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIAL'] },
        isPaused: false,
        expiresAt: { lte: before, not: null },
      },
      include: { business: true, plan: true },
    });
  }

  async listActiveSubscriptions() {
    return prisma.businessSubscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIAL'] },
        isPaused: false,
        expiresAt: { not: null },
      },
      include: { business: true, plan: true },
    });
  }

  async listActivityLogs(businessId: string, limit = 50) {
    return prisma.subscriptionActivityLog.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { performedBy: { select: { email: true, firstName: true, lastName: true } } },
    });
  }

  async listHistory(businessId: string, limit = 50) {
    return prisma.subscriptionHistory.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { plan: true, performedBy: { select: { email: true } } },
    });
  }

  async listNotifications(businessId: string, limit = 50) {
    return prisma.subscriptionNotification.findMany({
      where: { businessId },
      orderBy: { scheduledFor: 'desc' },
      take: limit,
    });
  }

  async createNotification(data: Prisma.SubscriptionNotificationCreateInput) {
    return prisma.subscriptionNotification.create({ data });
  }

  async findPendingNotifications(dueBefore: Date) {
    return prisma.subscriptionNotification.findMany({
      where: { status: 'PENDING', scheduledFor: { lte: dueBefore } },
      include: { business: true, businessSubscription: { include: { plan: true } } },
    });
  }

  async markNotificationSent(id: string, message: string) {
    return prisma.subscriptionNotification.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), message },
    });
  }

  async markNotificationFailed(id: string, error: string) {
    return prisma.subscriptionNotification.update({
      where: { id },
      data: { status: 'FAILED', error },
    });
  }

  async logAction(params: {
    businessId: string;
    businessSubscriptionId?: string;
    action: SubscriptionActivityAction;
    performedById?: string;
    performedByEmail?: string;
    ipAddress?: string;
    oldValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    notes?: string;
  }) {
    return prisma.subscriptionActivityLog.create({
      data: {
        businessId: params.businessId,
        businessSubscriptionId: params.businessSubscriptionId,
        action: params.action,
        performedById: params.performedById,
        performedByEmail: params.performedByEmail,
        ipAddress: params.ipAddress,
        oldValue: params.oldValue as Prisma.InputJsonValue,
        newValue: params.newValue as Prisma.InputJsonValue,
        notes: params.notes,
      },
    });
  }
}

export const subscriptionRepository = new SubscriptionRepository();
