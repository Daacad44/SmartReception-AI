import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../core/errors';
import {
  CreateEmployeeBroadcastInput,
  PaginationInput,
} from '@smartreception/shared';
import { enqueueEmployeeBroadcastSend, removeEmployeeBroadcastQueueJobs } from './employee-broadcast-queue.utils';
import { assertEmployeeBroadcastAllowed } from './employee-limits.service';
import { enqueueEmployeeBroadcastBatches } from './employee-broadcast-batch.service';
import type { Prisma } from '@prisma/client';

async function resolveEmployeeRecipients(
  businessId: string,
  options: {
    sendToAll?: boolean;
    groupId?: string | null;
    department?: string | null;
    branch?: string | null;
    employeeIds?: string[];
  }
) {
  const { sendToAll, groupId, department, branch, employeeIds } = options;

  if (employeeIds?.length) {
    return prisma.employee.findMany({
      where: { businessId, isActive: true, status: 'ACTIVE', id: { in: employeeIds } },
    });
  }

  if (sendToAll) {
    return prisma.employee.findMany({
      where: { businessId, isActive: true, status: 'ACTIVE' },
    });
  }

  if (groupId) {
    const group = await prisma.employeeGroup.findFirst({
      where: { id: groupId, businessId },
      include: { members: { include: { employee: true } } },
    });
    if (!group) throw new NotFoundError('Employee group not found');
    return group.members.map((m) => m.employee).filter((e) => e.isActive && e.status === 'ACTIVE');
  }

  const where: Prisma.EmployeeWhereInput = {
    businessId,
    isActive: true,
    status: 'ACTIVE',
    ...(department && { department }),
    ...(branch && { branch }),
  };
  return prisma.employee.findMany({ where });
}

export async function executeEmployeeBroadcastSend(
  broadcastId: string,
  businessId: string
): Promise<void> {
  const broadcast = await prisma.employeeBroadcast.findFirst({
    where: { id: broadcastId, businessId },
    include: { business: { include: { whatsappAccounts: { where: { isActive: true }, take: 1 } } } },
  });
  if (!broadcast) return;
  if (['CANCELLED', 'PAUSED', 'ARCHIVED'].includes(broadcast.status)) return;

  const locked = await prisma.employeeBroadcast.updateMany({
    where: { id: broadcastId, businessId, status: { in: ['SCHEDULED', 'DRAFT', 'RUNNING'] } },
    data: { status: 'RUNNING' },
  });
  if (locked.count === 0) return;

  if (!broadcast.business.whatsappAccounts[0]) {
    await prisma.employeeBroadcast.update({ where: { id: broadcastId }, data: { status: 'FAILED' } });
    return;
  }

  await enqueueEmployeeBroadcastBatches(broadcastId, businessId, 0);
}

export class EmployeeBroadcastsService {
  async list(businessId: string, params: PaginationInput & { status?: string }) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.EmployeeBroadcastWhereInput = {
      businessId,
      archivedAt: null,
      ...(status && { status: status as never }),
    };
    const [data, total] = await Promise.all([
      prisma.employeeBroadcast.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { group: { select: { name: true } }, _count: { select: { recipients: true } } },
      }),
      prisma.employeeBroadcast.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async get(businessId: string, id: string) {
    const broadcast = await prisma.employeeBroadcast.findFirst({
      where: { id, businessId },
      include: {
        group: true,
        template: true,
        recipients: {
          take: 100,
          include: { employee: { select: { id: true, fullName: true, phone: true, department: true } } },
        },
        _count: { select: { recipients: true } },
      },
    });
    if (!broadcast) throw new NotFoundError('Broadcast not found');
    return broadcast;
  }

  async create(businessId: string, input: CreateEmployeeBroadcastInput, userId: string) {
    const employees = await resolveEmployeeRecipients(businessId, {
      sendToAll: input.sendToAll,
      groupId: input.groupId,
      department: input.department,
      branch: input.branch,
      employeeIds: input.employeeIds,
    });
    if (!employees.length) throw new NotFoundError('No employees match the selected audience');
    await assertEmployeeBroadcastAllowed(businessId, employees.length);

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { timezone: true },
    });

    const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
    const sendNow = input.sendNow === true;
    const timezone = input.timezone ?? business?.timezone ?? 'UTC';

    const broadcast = await prisma.employeeBroadcast.create({
      data: {
        businessId,
        name: input.name,
        message: input.message,
        type: input.type ?? 'ANNOUNCEMENT',
        schedule: input.schedule ?? 'ONE_TIME',
        messageType: input.messageType ?? 'TEXT',
        groupId: input.groupId,
        department: input.department,
        branch: input.branch,
        employeeIds: input.employeeIds ?? [],
        sendToAll: input.sendToAll ?? false,
        templateId: input.templateId,
        mediaUrl: input.mediaUrl,
        mediaFilename: input.mediaFilename,
        timezone,
        cronExpression: input.cronExpression,
        scheduleConfig: input.scheduleConfig as object,
        repeatCount: input.repeatCount,
        repeatUntil: input.repeatUntil ? new Date(input.repeatUntil) : null,
        isEmergency: input.isEmergency ?? false,
        scheduledAt: sendNow ? new Date() : scheduledAt,
        nextRunAt: sendNow ? new Date() : scheduledAt,
        status: sendNow ? 'SCHEDULED' : scheduledAt ? 'SCHEDULED' : 'DRAFT',
        createdById: userId,
        recipients: {
          create: employees.map((e) => ({
            employeeId: e.id,
            phone: e.whatsappNumber || e.phone,
          })),
        },
      },
    });

    if (sendNow || scheduledAt) {
      const runAt = sendNow ? new Date() : scheduledAt!;
      await enqueueEmployeeBroadcastSend(broadcast.id, businessId, runAt, broadcast.id);
    }

    return broadcast;
  }

  async sendNow(businessId: string, id: string) {
    const broadcast = await this.get(businessId, id);
    await prisma.employeeBroadcast.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt: new Date(), nextRunAt: new Date() },
    });
    await enqueueEmployeeBroadcastSend(id, businessId, new Date(), id);
    return broadcast;
  }

  async pause(businessId: string, id: string) {
    await this.get(businessId, id);
    await removeEmployeeBroadcastQueueJobs(id);
    await prisma.employeeBroadcast.update({ where: { id }, data: { status: 'PAUSED' } });
  }

  async resume(businessId: string, id: string) {
    const broadcast = await this.get(businessId, id);
    await prisma.employeeBroadcast.update({ where: { id }, data: { status: 'SCHEDULED' } });
    await enqueueEmployeeBroadcastSend(id, businessId, new Date(), `${id}-resume`);
    return broadcast;
  }

  async cancel(businessId: string, id: string) {
    await removeEmployeeBroadcastQueueJobs(id);
    await prisma.employeeBroadcast.update({ where: { id, businessId }, data: { status: 'CANCELLED' } });
  }

  async analytics(businessId: string) {
    const [totals, recent] = await Promise.all([
      prisma.employeeBroadcast.aggregate({
        where: { businessId },
        _sum: { sentCount: true, deliveredCount: true, failedCount: true, readCount: true, responseCount: true },
        _count: true,
      }),
      prisma.employeeBroadcast.findMany({
        where: { businessId },
        orderBy: { lastRunAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          status: true,
          sentCount: true,
          deliveredCount: true,
          failedCount: true,
          readCount: true,
          lastRunAt: true,
        },
      }),
    ]);
    const sent = totals._sum.sentCount ?? 0;
    const delivered = totals._sum.deliveredCount ?? 0;
    return {
      totals: {
        broadcasts: totals._count,
        sent,
        delivered,
        failed: totals._sum.failedCount ?? 0,
        read: totals._sum.readCount ?? 0,
        responses: totals._sum.responseCount ?? 0,
      },
      deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
      recentActivity: recent,
    };
  }

  async deliveries(
    businessId: string,
    params: PaginationInput & { status?: string }
  ) {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.EmployeeBroadcastRecipientWhereInput = {
      broadcast: { businessId },
      ...(status && { status: status as never }),
    };
    const [data, total] = await Promise.all([
      prisma.employeeBroadcastRecipient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          employee: { select: { id: true, fullName: true, phone: true, department: true } },
          broadcast: { select: { id: true, name: true, type: true, status: true } },
        },
      }),
      prisma.employeeBroadcastRecipient.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}

export const employeeBroadcastsService = new EmployeeBroadcastsService();
