import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError } from '../../core/errors';
import { CreateCampaignInput, UpdateCampaignInput, PaginationInput } from '@smartreception/shared';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { broadcastBusinessEvent } from '../../infrastructure/realtime/broadcast.service';
import type { CustomerType, Prisma } from '@prisma/client';
import { logger } from '../../core/logger';
import { enqueueCampaignSend, removeCampaignQueueJobs } from './campaign-queue.utils';
import { resolveStoredToken } from '../../infrastructure/crypto/token-crypto';

function computeNextRun(schedule: string, from: Date): Date | null {
  const next = new Date(from);
  switch (schedule) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      return next;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      return next;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      return next;
    default:
      return null;
  }
}

async function resolveRecipients(
  businessId: string,
  options: {
    segmentId?: string | null;
    customerTypes?: CustomerType[];
    sendToAll?: boolean;
    targetCustomerId?: string | null;
  }
) {
  const { segmentId, customerTypes, sendToAll, targetCustomerId } = options;

  if (targetCustomerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: targetCustomerId, businessId, isActive: true },
    });
    if (!customer) throw new NotFoundError('Customer not found');
    return [customer];
  }

  if (sendToAll) {
    return prisma.customer.findMany({ where: { businessId, isActive: true } });
  }

  if (segmentId) {
    const segment = await prisma.customerSegment.findFirst({
      where: { id: segmentId, businessId },
      include: { members: { include: { customer: true } } },
    });
    if (!segment) throw new NotFoundError('Segment not found');

    if (segment.customerType) {
      return prisma.customer.findMany({
        where: { businessId, isActive: true, customerType: segment.customerType },
      });
    }
    return segment.members.map((m) => m.customer).filter((c) => c.isActive);
  }

  if (customerTypes && customerTypes.length > 0) {
    return prisma.customer.findMany({
      where: { businessId, isActive: true, customerType: { in: customerTypes } },
    });
  }

  return prisma.customer.findMany({ where: { businessId, isActive: true } });
}

export async function executeCampaignSend(campaignId: string, businessId: string): Promise<void> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, businessId },
    include: { business: { include: { whatsappAccounts: { where: { isActive: true }, take: 1 } } } },
  });
  if (!campaign) return;

  if (campaign.status === 'CANCELLED' || campaign.status === 'COMPLETED') return;

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
      status: { in: ['SCHEDULED', 'DRAFT', 'SENDING'] },
      isSent: false,
    },
    data: { status: 'SENDING' },
  });
  if (locked.count === 0) return;

  const whatsappAccount = campaign.business.whatsappAccounts[0];
  if (!whatsappAccount) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED' },
    });
    return;
  }

  const runVersion = campaign.runVersion;
  const recipients = await prisma.campaignRecipient.findMany({
    where: {
      campaignId,
      isSent: false,
      status: 'PENDING',
      runVersion,
    },
    include: { customer: true },
  });

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const claimed = await prisma.campaignRecipient.updateMany({
      where: {
        id: recipient.id,
        isSent: false,
        status: 'PENDING',
        runVersion,
      },
      data: { status: 'SENDING' },
    });
    if (claimed.count === 0) continue;

    const phone = recipient.customer.whatsappNumber || recipient.customer.phone;
    const result = await whatsappService.sendOutbound({
      phoneNumberId: whatsappAccount.phoneNumberId,
      to: phone,
      accessToken: resolveStoredToken(whatsappAccount.accessToken),
      type: 'TEXT',
      content: campaign.message,
    });

    if (result.success) {
      sent++;
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'SENT',
          isSent: true,
          whatsappMsgId: result.whatsappMsgId,
          sentAt: new Date(),
        },
      });
    } else {
      failed++;
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'FAILED',
          isSent: true,
          failedReason: result.error?.message || 'Send failed',
        },
      });
    }
  }

  const isRecurring = campaign.schedule !== 'ONE_TIME';
  const nextRunAt = isRecurring ? computeNextRun(campaign.schedule, new Date()) : null;
  const allFailed = failed === recipients.length && recipients.length > 0;
  const oneTimeComplete = !isRecurring;
  const nextRunVersion = runVersion + 1;

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: allFailed ? 'FAILED' : oneTimeComplete ? 'COMPLETED' : 'SCHEDULED',
      isSent: oneTimeComplete,
      sentCount: { increment: sent },
      deliveredCount: { increment: sent },
      failedCount: { increment: failed },
      lastRunAt: new Date(),
      nextRunAt: oneTimeComplete ? null : nextRunAt,
      runVersion: isRecurring ? nextRunVersion : undefined,
    },
  });

  if (isRecurring && nextRunAt) {
    await prisma.campaignRecipient.updateMany({
      where: { campaignId },
      data: { isSent: false, status: 'PENDING', runVersion: nextRunVersion },
    });
    await enqueueCampaignSend(
      campaignId,
      businessId,
      nextRunAt,
      `${campaignId}-${nextRunAt.getTime()}`
    );
  }

  if (sent > 0 || failed > 0) {
    await prisma.notification.create({
      data: {
        businessId,
        type: failed > 0 ? 'CAMPAIGN_FAILED' : 'CAMPAIGN_DELIVERED',
        title: failed > 0 ? 'Campaign partially failed' : 'Campaign delivered',
        message: `${campaign.name}: ${sent} sent, ${failed} failed`,
        data: { campaignId },
      },
    });
    void broadcastBusinessEvent(businessId, { type: 'campaign', campaignId, action: 'sent' });
  }
}

export class CampaignsService {
  async list(businessId: string, params: PaginationInput & { status?: string }) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.CampaignWhereInput = {
      businessId,
      ...(status && { status: status as Prisma.EnumCampaignStatusFilter['equals'] }),
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

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
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

    const customers = await resolveRecipients(businessId, {
      segmentId: input.segmentId,
      customerTypes: input.customerTypes,
      sendToAll: input.sendToAll,
      targetCustomerId: input.targetCustomerId,
    });
    if (customers.length === 0) {
      throw new ValidationError('No customers match the selected audience');
    }

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    const sendNow = input.sendNow ?? !scheduledAt;
    const status = sendNow ? 'SENDING' : scheduledAt ? 'SCHEDULED' : 'DRAFT';

    const campaign = await prisma.campaign.create({
      data: {
        businessId,
        name: input.name,
        message,
        type: input.type,
        schedule: input.schedule,
        status,
        segmentId: input.segmentId,
        templateId: input.templateId,
        targetCustomerId: input.targetCustomerId,
        customerTypes: input.customerTypes ?? [],
        sendToAll: input.sendToAll ?? false,
        isSent: false,
        scheduledAt: sendNow ? new Date() : scheduledAt,
        nextRunAt: sendNow ? null : scheduledAt,
        createdById: userId,
        recipients: {
          create: customers.map((c) => ({
            customerId: c.id,
            phone: c.whatsappNumber || c.phone,
            isSent: false,
            runVersion: 0,
          })),
        },
      },
      include: { _count: { select: { recipients: true } } },
    });

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'CREATE', entity: 'Campaign', entityId: campaign.id },
    });

    if (sendNow) {
      void executeCampaignSend(campaign.id, businessId).catch((err) =>
        logger.error('Campaign send failed', err)
      );
    } else if (scheduledAt) {
      await enqueueCampaignSend(campaign.id, businessId, scheduledAt, campaign.id);
    }

    return campaign;
  }

  async update(businessId: string, id: string, input: UpdateCampaignInput, userId: string) {
    const existing = await prisma.campaign.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError('Campaign not found');
    if (['SENDING', 'COMPLETED'].includes(existing.status) || existing.isSent) {
      throw new ValidationError('Cannot update a campaign that has already been sent');
    }

    await removeCampaignQueueJobs(id);

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        name: input.name,
        message: input.message,
        type: input.type,
        schedule: input.schedule,
        segmentId: input.segmentId,
        targetCustomerId: input.targetCustomerId,
        customerTypes: input.customerTypes,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        status: input.scheduledAt ? 'SCHEDULED' : undefined,
        nextRunAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      },
    });

    if (input.scheduledAt) {
      await enqueueCampaignSend(id, businessId, new Date(input.scheduledAt), id);
    }

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'UPDATE', entity: 'Campaign', entityId: id, newData: input as object },
    });

    return campaign;
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
      where: { businessId },
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
        createdAt: true,
        lastRunAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const totals = campaigns.reduce(
      (acc, c) => ({
        sent: acc.sent + c.sentCount,
        delivered: acc.delivered + c.deliveredCount,
        failed: acc.failed + c.failedCount,
        read: acc.read + c.readCount,
        responses: acc.responses + c.responseCount,
        linkClicks: acc.linkClicks + c.linkClickCount,
      }),
      { sent: 0, delivered: 0, failed: 0, read: 0, responses: 0, linkClicks: 0 }
    );

    const responseRate =
      totals.delivered > 0 ? Math.round((totals.responses / totals.delivered) * 1000) / 10 : 0;
    const deliveryRate =
      totals.sent > 0 ? Math.round((totals.delivered / totals.sent) * 1000) / 10 : 0;
    const readRate =
      totals.delivered > 0 ? Math.round((totals.read / totals.delivered) * 1000) / 10 : 0;

    const byType = Object.entries(
      campaigns.reduce<Record<string, { count: number; sent: number }>>((acc, c) => {
        if (!acc[c.type]) acc[c.type] = { count: 0, sent: 0 };
        acc[c.type].count++;
        acc[c.type].sent += c.sentCount;
        return acc;
      }, {})
    ).map(([type, data]) => ({ type, ...data }));

    const recentActivity = campaigns.slice(0, 10).map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      sentCount: c.sentCount,
      deliveredCount: c.deliveredCount,
      failedCount: c.failedCount,
      readCount: c.readCount,
      lastRunAt: c.lastRunAt,
    }));

    return { totals, responseRate, deliveryRate, readRate, byType, recentActivity, campaigns };
  }
}

export const campaignsService = new CampaignsService();
