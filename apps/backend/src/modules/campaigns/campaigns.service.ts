import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError } from '../../core/errors';
import { CreateCampaignInput, UpdateCampaignInput, PaginationInput } from '@smartreception/shared';
import { broadcastBusinessEvent } from '../../infrastructure/realtime/broadcast.service';
import type { CustomerType, Prisma } from '@prisma/client';
import { logger } from '../../core/logger';
import { enqueueCampaignSend, removeCampaignQueueJobs } from './campaign-queue.utils';
import { assertCampaignCreateAllowed } from './campaign-limits.service';
import { enqueueCampaignBatches, finalizeCampaignIfComplete } from './campaign-batch.service';
import { applyCampaignDeliveryStats, getCampaignDeliveryStats } from './campaign-stats.service';
import { computeNextCampaignRun, type ScheduleConfig } from './campaign-scheduler.service';
import { personalizeCampaignMessage } from './campaign-personalization.service';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { resolveStoredToken } from '../../infrastructure/crypto/token-crypto';

type RecipientOptions = {
  segmentId?: string | null;
  customerTypes?: CustomerType[];
  sendToAll?: boolean;
  targetCustomerId?: string | null;
  customerIds?: string[];
};

async function resolveRecipientCount(businessId: string, options: RecipientOptions): Promise<number> {
  const { segmentId, customerTypes, sendToAll, targetCustomerId, customerIds } = options;

  if (customerIds?.length) {
    return prisma.customer.count({
      where: { businessId, isActive: true, id: { in: customerIds } },
    });
  }

  if (targetCustomerId) {
    return prisma.customer.count({
      where: { id: targetCustomerId, businessId, isActive: true },
    });
  }

  if (sendToAll) {
    return prisma.customer.count({
      where: { businessId, isActive: true, campaignOptOut: { is: null } },
    });
  }

  if (segmentId) {
    const segment = await prisma.customerSegment.findFirst({
      where: { id: segmentId, businessId },
      include: { members: { include: { customer: { include: { campaignOptOut: true } } } } },
    });
    if (!segment) throw new NotFoundError('Segment not found');

    if (segment.customerType) {
      return prisma.customer.count({
        where: { businessId, isActive: true, customerType: segment.customerType, campaignOptOut: { is: null } },
      });
    }
    return segment.members.filter((m) => m.customer.isActive && !m.customer.campaignOptOut).length;
  }

  if (customerTypes && customerTypes.length > 0) {
    return prisma.customer.count({
      where: { businessId, isActive: true, customerType: { in: customerTypes }, campaignOptOut: { is: null } },
    });
  }

  return prisma.customer.count({ where: { businessId, isActive: true, campaignOptOut: { is: null } } });
}

async function* iterateRecipientBatches(
  businessId: string,
  options: RecipientOptions,
  batchSize = 500
): AsyncGenerator<Array<{ id: string; phone: string; whatsappNumber: string | null }>> {
  const { segmentId, customerTypes, sendToAll, targetCustomerId, customerIds } = options;

  if (segmentId) {
    const segment = await prisma.customerSegment.findFirst({
      where: { id: segmentId, businessId },
      include: { members: { include: { customer: { include: { campaignOptOut: true } } } } },
    });
    if (!segment) throw new NotFoundError('Segment not found');

    if (!segment.customerType) {
      const customers = segment.members
        .map((m) => m.customer)
        .filter((c) => c.isActive && !c.campaignOptOut)
        .map((c) => ({ id: c.id, phone: c.phone, whatsappNumber: c.whatsappNumber }));
      for (let i = 0; i < customers.length; i += batchSize) {
        yield customers.slice(i, i + batchSize);
      }
      return;
    }
  }

  const where: Prisma.CustomerWhereInput = { businessId, isActive: true, campaignOptOut: { is: null } };
  if (customerIds?.length) {
    where.id = { in: customerIds };
  } else if (targetCustomerId) {
    where.id = targetCustomerId;
  } else if (segmentId) {
    const segment = await prisma.customerSegment.findFirst({ where: { id: segmentId, businessId } });
    if (segment?.customerType) where.customerType = segment.customerType;
  } else if (customerTypes?.length) {
    where.customerType = { in: customerTypes };
  }

  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.customer.findMany({
      where,
      select: { id: true, phone: true, whatsappNumber: true },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (batch.length === 0) break;
    yield batch;
    if (batch.length < batchSize) break;
    cursor = batch[batch.length - 1].id;
  }
}


export async function executeCampaignSend(campaignId: string, businessId: string): Promise<void> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, businessId },
    include: { business: { include: { whatsappAccounts: { where: { isActive: true }, take: 1 } } } },
  });
  if (!campaign) return;

  if (['CANCELLED', 'PAUSED', 'ARCHIVED'].includes(campaign.status)) return;

  if (campaign.schedule === 'ONE_TIME' && campaign.isSent) {
    logger.info('Campaign already delivered — skipping duplicate send', { campaignId });
    return;
  }

  if (
    campaign.schedule === 'ONE_TIME' &&
    campaign.scheduledAt &&
    campaign.scheduledAt.getTime() > Date.now() + 5000
  ) {
    logger.info('Campaign scheduled for future — skipping early execution', { campaignId });
    return;
  }

  const locked = await prisma.campaign.updateMany({
    where: {
      id: campaignId,
      businessId,
      status: { in: ['SCHEDULED', 'DRAFT', 'SENDING', 'RUNNING'] },
      isSent: false,
    },
    data: { status: 'RUNNING' },
  });
  if (locked.count === 0) return;

  if (!campaign.business.whatsappAccounts[0]) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'FAILED' } });
    return;
  }

  const batches = await enqueueCampaignBatches(campaignId, businessId, campaign.runVersion);
  if (batches === 0) {
    await finalizeCampaignIfComplete(campaignId, businessId);
  }
}

export class CampaignsService {
  async list(businessId: string, params: PaginationInput & { status?: string; from?: string; to?: string }) {
    const { page, limit, status, from, to } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.CampaignWhereInput = {
      businessId,
      archivedAt: null,
      ...(status && { status: status as Prisma.EnumCampaignStatusFilter['equals'] }),
      ...(from || to
        ? {
            OR: [
              { scheduledAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } },
              { nextRunAt: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          segment: { select: { id: true, name: true } },
          targetCustomer: { select: { id: true, name: true, phone: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { recipients: true } },
        },
      }),
      prisma.campaign.count({ where }),
    ]);

    const stats = await getCampaignDeliveryStats(data.map((c) => c.id));

    return {
      data: applyCampaignDeliveryStats(data, stats),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCalendar(businessId: string, from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const campaigns = await prisma.campaign.findMany({
      where: {
        businessId,
        archivedAt: null,
        OR: [
          { scheduledAt: { gte: fromDate, lte: toDate } },
          { nextRunAt: { gte: fromDate, lte: toDate } },
          { lastRunAt: { gte: fromDate, lte: toDate } },
        ],
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        schedule: true,
        scheduledAt: true,
        nextRunAt: true,
        lastRunAt: true,
        sentCount: true,
        _count: { select: { recipients: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    return { campaigns };
  }

  async listDeliveries(
    businessId: string,
    params: PaginationInput & { status?: string; deliveryTab?: string }
  ) {
    const { page, limit, status, deliveryTab } = params;
    const skip = (page - 1) * limit;

    const tabStatusMap: Record<string, Prisma.CampaignRecipientWhereInput> = {
      scheduled: { status: 'PENDING', campaign: { businessId, status: { in: ['SCHEDULED', 'DRAFT'] } } },
      processing: { status: 'SENDING', campaign: { businessId } },
      sent: { status: { in: ['SENT', 'DELIVERED', 'READ'] }, campaign: { businessId } },
      failed: { status: 'FAILED', campaign: { businessId } },
      cancelled: { campaign: { businessId, status: 'CANCELLED' } },
    };

    const where: Prisma.CampaignRecipientWhereInput =
      deliveryTab && tabStatusMap[deliveryTab]
        ? tabStatusMap[deliveryTab]
        : {
            campaign: { businessId },
            ...(status && { status: status as Prisma.EnumCampaignRecipientStatusFilter['equals'] }),
          };

    const [data, total] = await Promise.all([
      prisma.campaignRecipient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true, whatsappNumber: true } },
          campaign: {
            select: {
              id: true,
              name: true,
              type: true,
              schedule: true,
              status: true,
              scheduledAt: true,
              lastRunAt: true,
            },
          },
        },
      }),
      prisma.campaignRecipient.count({ where }),
    ]);

    return {
      data: data.map((r) => ({
        id: r.id,
        customerName: r.customer.name,
        phone: r.phone,
        campaignId: r.campaign.id,
        campaignName: r.campaign.name,
        campaignType: r.campaign.type,
        campaignStatus: r.campaign.status,
        scheduledAt: r.campaign.scheduledAt,
        sentAt: r.sentAt,
        deliveredAt: r.deliveredAt,
        readAt: r.readAt,
        status: r.status,
        isSent: r.isSent,
        failedReason: r.failedReason,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async get(businessId: string, id: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id, businessId },
      include: {
        segment: true,
        targetCustomer: { select: { id: true, name: true, phone: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        recipients: {
          include: { customer: { select: { id: true, name: true, phone: true } } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });
    if (!campaign) throw new NotFoundError('Campaign not found');
    return campaign;
  }

  async create(businessId: string, input: CreateCampaignInput, userId: string) {
    let message = input.message;
    if (input.templateId) {
      const template = await prisma.messageTemplate.findFirst({
        where: { id: input.templateId, businessId },
      });
      if (!template) throw new NotFoundError('Template not found');
      if (!message) message = template.content;
    }

    const recipientOptions: RecipientOptions = {
      segmentId: input.segmentId,
      customerTypes: input.customerTypes,
      sendToAll: input.sendToAll,
      targetCustomerId: input.targetCustomerId,
      customerIds: input.customerIds,
    };

    const recipientCount = await resolveRecipientCount(businessId, recipientOptions);
    if (recipientCount === 0) {
      throw new ValidationError('No customers match the selected audience');
    }

    await assertCampaignCreateAllowed(businessId, recipientCount);

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { timezone: true },
    });

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    const sendNow = input.sendNow ?? !scheduledAt;
    const status = sendNow ? 'RUNNING' : scheduledAt ? 'SCHEDULED' : 'DRAFT';
    const timezone = input.timezone ?? business?.timezone ?? 'UTC';

    const campaign = await prisma.campaign.create({
      data: {
        businessId,
        name: input.name,
        message,
        type: input.type,
        schedule: input.schedule,
        status: sendNow ? 'RUNNING' : scheduledAt ? 'SCHEDULED' : 'DRAFT',
        messageType: input.messageType ?? 'TEXT',
        segmentId: input.segmentId,
        templateId: input.templateId,
        targetCustomerId: input.targetCustomerId,
        customerTypes: input.customerTypes ?? [],
        sendToAll: input.sendToAll ?? false,
        isSent: false,
        scheduledAt: sendNow ? new Date() : scheduledAt,
        nextRunAt: sendNow ? null : scheduledAt,
        timezone,
        cronExpression: input.cronExpression,
        scheduleConfig: input.scheduleConfig as object | undefined,
        repeatCount: input.repeatCount,
        repeatUntil: input.repeatUntil ? new Date(input.repeatUntil) : undefined,
        mediaUrl: input.mediaUrl,
        mediaFilename: input.mediaFilename,
        category: input.category,
        createdById: userId,
      },
    });

    void this.attachRecipientsAndDispatch({
      campaignId: campaign.id,
      businessId,
      recipientOptions,
      sendNow,
      scheduledAt,
    }).catch((err) => logger.error('Campaign recipient build failed', { campaignId: campaign.id, err }));

    return { ...campaign, _count: { recipients: recipientCount } };
  }

  private async attachRecipientsAndDispatch(params: {
    campaignId: string;
    businessId: string;
    recipientOptions: RecipientOptions;
    sendNow: boolean;
    scheduledAt: Date | null;
  }) {
    const { campaignId, businessId, recipientOptions, sendNow, scheduledAt } = params;

    for await (const batch of iterateRecipientBatches(businessId, recipientOptions)) {
      await prisma.campaignRecipient.createMany({
        data: batch.map((c) => ({
          campaignId,
          customerId: c.id,
          phone: c.whatsappNumber || c.phone,
          isSent: false,
          runVersion: 0,
        })),
        skipDuplicates: true,
      });
    }

    await prisma.auditLog.create({
      data: { businessId, action: 'CREATE', entity: 'Campaign', entityId: campaignId },
    });

    if (sendNow) {
      void executeCampaignSend(campaignId, businessId).catch((err) =>
        logger.error('Campaign send failed', err)
      );
    } else if (scheduledAt) {
      await enqueueCampaignSend(campaignId, businessId, scheduledAt, campaignId);
    }
  }

  async update(businessId: string, id: string, input: UpdateCampaignInput, userId: string) {
    const existing = await prisma.campaign.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError('Campaign not found');
    if (['SENDING', 'RUNNING', 'COMPLETED'].includes(existing.status) || existing.isSent) {
      throw new ValidationError('Cannot update a campaign that has already been sent');
    }

    await removeCampaignQueueJobs(id);

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        name: input.name,
        message: input.message,
        type: input.type,
        schedule: input.schedule,
        messageType: input.messageType,
        segmentId: input.segmentId,
        targetCustomerId: input.targetCustomerId,
        customerTypes: input.customerTypes,
        scheduledAt,
        status: scheduledAt ? 'SCHEDULED' : undefined,
        nextRunAt: scheduledAt,
        timezone: input.timezone,
        cronExpression: input.cronExpression,
        scheduleConfig: input.scheduleConfig as object | undefined,
        repeatCount: input.repeatCount,
        repeatUntil: input.repeatUntil ? new Date(input.repeatUntil) : undefined,
        mediaUrl: input.mediaUrl,
        mediaFilename: input.mediaFilename,
        category: input.category,
      },
    });

    if (scheduledAt) {
      await enqueueCampaignSend(id, businessId, scheduledAt, id);
    }

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'UPDATE', entity: 'Campaign', entityId: id, newData: input as object },
    });

    return campaign;
  }

  async pause(businessId: string, id: string, userId: string) {
    const existing = await prisma.campaign.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError('Campaign not found');
    await removeCampaignQueueJobs(id);
    await prisma.campaign.update({ where: { id }, data: { status: 'PAUSED' } });
    await prisma.auditLog.create({
      data: { businessId, userId, action: 'UPDATE', entity: 'Campaign', entityId: id, newData: { paused: true } },
    });
  }

  async resume(businessId: string, id: string, userId: string) {
    const existing = await prisma.campaign.findFirst({ where: { id, businessId, status: 'PAUSED' } });
    if (!existing) throw new NotFoundError('Paused campaign not found');
    const runAt = existing.nextRunAt ?? existing.scheduledAt ?? new Date();
    await prisma.campaign.update({ where: { id }, data: { status: 'SCHEDULED', nextRunAt: runAt } });
    await enqueueCampaignSend(id, businessId, runAt, id);
    await prisma.auditLog.create({
      data: { businessId, userId, action: 'UPDATE', entity: 'Campaign', entityId: id, newData: { resumed: true } },
    });
  }

  async duplicate(businessId: string, id: string, userId: string) {
    const existing = await prisma.campaign.findFirst({
      where: { id, businessId },
      include: { recipients: { select: { customerId: true, phone: true } } },
    });
    if (!existing) throw new NotFoundError('Campaign not found');

    return prisma.campaign.create({
      data: {
        businessId,
        name: `${existing.name} (Copy)`,
        message: existing.message,
        type: existing.type,
        schedule: existing.schedule,
        status: 'DRAFT',
        messageType: existing.messageType,
        segmentId: existing.segmentId,
        templateId: existing.templateId,
        customerTypes: existing.customerTypes,
        sendToAll: existing.sendToAll,
        targetCustomerId: existing.targetCustomerId,
        timezone: existing.timezone,
        cronExpression: existing.cronExpression,
        scheduleConfig: existing.scheduleConfig ?? undefined,
        repeatCount: existing.repeatCount,
        repeatUntil: existing.repeatUntil,
        mediaUrl: existing.mediaUrl,
        mediaFilename: existing.mediaFilename,
        category: existing.category,
        createdById: userId,
        recipients: {
          create: existing.recipients.map((r) => ({
            customerId: r.customerId,
            phone: r.phone,
            runVersion: 0,
          })),
        },
      },
    });
  }

  async archive(businessId: string, id: string, userId: string) {
    const existing = await prisma.campaign.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError('Campaign not found');
    await removeCampaignQueueJobs(id);
    await prisma.campaign.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: { businessId, userId, action: 'UPDATE', entity: 'Campaign', entityId: id, newData: { archived: true } },
    });
  }

  async testSend(businessId: string, id: string, phone: string, userId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id, businessId },
      include: { business: { include: { whatsappAccounts: { where: { isActive: true }, take: 1 } } } },
    });
    if (!campaign) throw new NotFoundError('Campaign not found');
    const account = campaign.business.whatsappAccounts[0];
    if (!account) throw new ValidationError('WhatsApp not connected');

    const content = personalizeCampaignMessage(campaign.message, {
      businessName: campaign.business.name,
      customer: { name: 'Test Customer', phone, email: null, companyName: null, city: null, country: null },
    });

    const result = await whatsappService.sendOutbound({
      phoneNumberId: account.phoneNumberId,
      to: phone,
      accessToken: resolveStoredToken(account.accessToken),
      type: 'TEXT',
      content,
    });
    if (!result.success) throw new ValidationError(result.error?.message || 'Test send failed');

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'UPDATE', entity: 'Campaign', entityId: id, newData: { testSend: phone } },
    });
    return { success: true, whatsappMsgId: result.whatsappMsgId };
  }

  async cancel(businessId: string, id: string, userId: string) {
    const existing = await prisma.campaign.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError('Campaign not found');

    await removeCampaignQueueJobs(id);
    await prisma.campaign.update({ where: { id }, data: { status: 'CANCELLED' } });

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'UPDATE', entity: 'Campaign', entityId: id, newData: { cancelled: true } },
    });
  }

  async sendNow(businessId: string, id: string, userId: string) {
    const existing = await prisma.campaign.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError('Campaign not found');
    if (existing.isSent) throw new ValidationError('Campaign has already been delivered');

    await removeCampaignQueueJobs(id);
    void executeCampaignSend(id, businessId).catch((err) => logger.error('Campaign send failed', err));

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'UPDATE', entity: 'Campaign', entityId: id, newData: { sendNow: true } },
    });
  }

  async getAnalytics(businessId: string) {
    const campaigns = await prisma.campaign.findMany({
      where: { businessId, archivedAt: null },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        sentCount: true,
        deliveredCount: true,
        failedCount: true,
        readCount: true,
        responseCount: true,
        linkClickCount: true,
        optOutCount: true,
        blockedCount: true,
        createdAt: true,
        lastRunAt: true,
        _count: { select: { recipients: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const totals = campaigns.reduce(
      (acc, c) => ({
        recipients: acc.recipients + c._count.recipients,
        sent: acc.sent + c.sentCount,
        delivered: acc.delivered + c.deliveredCount,
        failed: acc.failed + c.failedCount,
        read: acc.read + c.readCount,
        responses: acc.responses + c.responseCount,
        linkClicks: acc.linkClicks + c.linkClickCount,
        optOuts: acc.optOuts + c.optOutCount,
        blocked: acc.blocked + c.blockedCount,
      }),
      { recipients: 0, sent: 0, delivered: 0, failed: 0, read: 0, responses: 0, linkClicks: 0, optOuts: 0, blocked: 0 }
    );

    const responseRate = totals.delivered > 0 ? Math.round((totals.responses / totals.delivered) * 1000) / 10 : 0;
    const deliveryRate = totals.sent > 0 ? Math.round((totals.delivered / totals.sent) * 1000) / 10 : 0;
    const readRate = totals.delivered > 0 ? Math.round((totals.read / totals.delivered) * 1000) / 10 : 0;
    const ctr = totals.delivered > 0 ? Math.round((totals.linkClicks / totals.delivered) * 1000) / 10 : 0;

    const byType = Object.entries(
      campaigns.reduce<Record<string, { count: number; sent: number }>>((acc, c) => {
        if (!acc[c.type]) acc[c.type] = { count: 0, sent: 0 };
        acc[c.type].count++;
        acc[c.type].sent += c.sentCount;
        return acc;
      }, {})
    ).map(([type, data]) => ({ type, ...data }));

    return {
      totals,
      responseRate,
      deliveryRate,
      readRate,
      ctr,
      byType,
      recentActivity: campaigns.slice(0, 10),
      campaigns,
    };
  }
}

export const campaignsService = new CampaignsService();
