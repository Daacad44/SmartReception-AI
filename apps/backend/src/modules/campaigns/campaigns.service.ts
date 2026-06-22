import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError } from '../../core/errors';
import { CreateCampaignInput, UpdateCampaignInput, PaginationInput } from '@smartreception/shared';
import { whatsappService } from '../../infrastructure/whatsapp/whatsapp.service';
import { broadcastBusinessEvent } from '../../infrastructure/realtime/broadcast.service';
import { getCampaignQueue } from '../../infrastructure/queue/queues';
import type { CustomerType, Prisma } from '@prisma/client';
import { logger } from '../../core/logger';

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
  }
) {
  const { segmentId, customerTypes, sendToAll } = options;

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

  const whatsappAccount = campaign.business.whatsappAccounts[0];
  if (!whatsappAccount) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'FAILED' },
    });
    return;
  }

  await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'SENDING' } });

  const recipients = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: 'PENDING' },
    include: { customer: true },
  });

  let sent = 0;
  let delivered = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const phone = recipient.customer.whatsappNumber || recipient.customer.phone;
    const result = await whatsappService.sendOutbound({
      phoneNumberId: whatsappAccount.phoneNumberId,
      to: phone,
      accessToken: whatsappAccount.accessToken || undefined,
      type: 'TEXT',
      content: campaign.message,
    });

    if (result.success) {
      sent++;
      delivered++;
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'SENT',
          whatsappMsgId: result.whatsappMsgId,
          sentAt: new Date(),
          deliveredAt: new Date(),
        },
      });
    } else {
      failed++;
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'FAILED',
          failedReason: result.error?.message || 'Send failed',
        },
      });
    }
  }

  const isRecurring = campaign.schedule !== 'ONE_TIME';
  const nextRunAt = isRecurring ? computeNextRun(campaign.schedule, new Date()) : null;

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: failed === recipients.length && recipients.length > 0 ? 'FAILED' : isRecurring ? 'SCHEDULED' : 'COMPLETED',
      sentCount: { increment: sent },
      deliveredCount: { increment: delivered },
      failedCount: { increment: failed },
      lastRunAt: new Date(),
      nextRunAt,
    },
  });

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

  if (isRecurring && nextRunAt) {
    const queue = getCampaignQueue();
    if (queue) {
      const delay = nextRunAt.getTime() - Date.now();
      if (delay > 0) {
        await queue.add('campaign-send', { campaignId, businessId }, { delay, jobId: `${campaignId}-${nextRunAt.getTime()}` });
      }
    }
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

  async get(businessId: string, id: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id, businessId },
      include: {
        segment: true,
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
    });
    if (customers.length === 0) {
      throw new ValidationError('No customers match the selected segment or filters');
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
        customerTypes: input.customerTypes ?? [],
        sendToAll: input.sendToAll ?? false,
        scheduledAt: sendNow ? new Date() : scheduledAt,
        nextRunAt: sendNow ? null : scheduledAt,
        createdById: userId,
        recipients: {
          create: customers.map((c) => ({
            customerId: c.id,
            phone: c.whatsappNumber || c.phone,
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
      const queue = getCampaignQueue();
      const delay = scheduledAt.getTime() - Date.now();
      if (queue && delay > 0) {
        await queue.add('campaign-send', { campaignId: campaign.id, businessId }, { delay, jobId: campaign.id });
      } else {
        void executeCampaignSend(campaign.id, businessId).catch(() => undefined);
      }
    }

    return campaign;
  }

  async update(businessId: string, id: string, input: UpdateCampaignInput, userId: string) {
    const existing = await prisma.campaign.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError('Campaign not found');
    if (['SENDING', 'COMPLETED'].includes(existing.status)) {
      throw new ValidationError('Cannot update a campaign that has already been sent');
    }

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        name: input.name,
        message: input.message,
        type: input.type,
        schedule: input.schedule,
        segmentId: input.segmentId,
        customerTypes: input.customerTypes,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        status: input.scheduledAt ? 'SCHEDULED' : undefined,
        nextRunAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      },
    });

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'UPDATE', entity: 'Campaign', entityId: id, newData: input as object },
    });

    return campaign;
  }

  async cancel(businessId: string, id: string, userId: string) {
    const existing = await prisma.campaign.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError('Campaign not found');

    await prisma.campaign.update({ where: { id }, data: { status: 'CANCELLED' } });

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'UPDATE', entity: 'Campaign', entityId: id, newData: { cancelled: true } },
    });
  }

  async sendNow(businessId: string, id: string, userId: string) {
    const existing = await prisma.campaign.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError('Campaign not found');

    await prisma.campaign.update({ where: { id }, data: { status: 'SENDING' } });
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
