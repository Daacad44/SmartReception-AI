import * as XLSX from 'xlsx';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError } from '../../core/errors';
import type { CreateEmployeeGroupInput, UpdateEmployeeGroupInput } from '@smartreception/shared';

export class EmployeeGroupsService {
  async list(businessId: string, includeArchived = false) {
    return prisma.employeeGroup.findMany({
      where: {
        businessId,
        ...(includeArchived ? {} : { status: 'ACTIVE', archivedAt: null }),
      },
      include: {
        _count: { select: { members: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        members: {
          take: 5,
          include: { employee: { select: { id: true, fullName: true, profilePhotoUrl: true } } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async get(businessId: string, id: string) {
    const group = await prisma.employeeGroup.findFirst({
      where: { id, businessId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        members: {
          include: {
            employee: {
              select: {
                id: true, fullName: true, phone: true, department: true,
                jobTitle: true, status: true, profilePhotoUrl: true,
              },
            },
          },
          orderBy: { addedAt: 'desc' },
        },
        _count: { select: { members: true } },
      },
    });
    if (!group) throw new NotFoundError('Group not found');
    return group;
  }

  async create(businessId: string, input: CreateEmployeeGroupInput, ownerId?: string) {
    return prisma.employeeGroup.create({
      data: {
        businessId,
        name: input.name,
        description: input.description,
        color: input.color,
        department: input.department,
        notes: input.notes,
        ownerId: input.ownerId ?? ownerId,
        members: input.employeeIds?.length
          ? { create: input.employeeIds.map((employeeId) => ({ employeeId })) }
          : undefined,
      },
      include: { _count: { select: { members: true } } },
    });
  }

  async update(businessId: string, id: string, input: UpdateEmployeeGroupInput) {
    const group = await prisma.employeeGroup.findFirst({ where: { id, businessId } });
    if (!group) throw new NotFoundError('Group not found');
    if (group.isSystem) throw new ValidationError('System groups cannot be modified');

    if (input.employeeIds) {
      await prisma.employeeGroupMember.deleteMany({ where: { groupId: id } });
      if (input.employeeIds.length) {
        await prisma.employeeGroupMember.createMany({
          data: input.employeeIds.map((employeeId) => ({ employeeId, groupId: id })),
        });
      }
    }

    return prisma.employeeGroup.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        color: input.color,
        department: input.department,
        notes: input.notes,
        ownerId: input.ownerId,
      },
      include: { _count: { select: { members: true } } },
    });
  }

  async delete(businessId: string, id: string) {
    const group = await prisma.employeeGroup.findFirst({ where: { id, businessId } });
    if (!group) throw new NotFoundError('Group not found');
    if (group.isSystem) throw new ValidationError('System groups cannot be deleted');
    await prisma.employeeGroup.delete({ where: { id } });
  }

  async archive(businessId: string, id: string) {
    await this.get(businessId, id);
    return prisma.employeeGroup.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
  }

  async duplicate(businessId: string, id: string) {
    const group = await this.get(businessId, id);
    const copy = await prisma.employeeGroup.create({
      data: {
        businessId,
        name: `${group.name} (Copy)`,
        description: group.description,
        color: group.color,
        department: group.department,
        notes: group.notes,
        members: {
          create: group.members.map((m) => ({ employeeId: m.employee.id })),
        },
      },
      include: { _count: { select: { members: true } } },
    });
    return copy;
  }

  async merge(businessId: string, sourceId: string, targetId: string) {
    const [source, target] = await Promise.all([
      this.get(businessId, sourceId),
      this.get(businessId, targetId),
    ]);
    if (source.isSystem) throw new ValidationError('Cannot merge system groups');

    const memberIds = source.members.map((m) => m.employee.id);
    if (memberIds.length) {
      await prisma.employeeGroupMember.createMany({
        data: memberIds.map((employeeId) => ({ employeeId, groupId: target.id })),
        skipDuplicates: true,
      });
    }
    await prisma.employeeGroup.delete({ where: { id: source.id } });
    return this.get(businessId, target.id);
  }

  async addMembers(businessId: string, groupId: string, employeeIds: string[]) {
    await this.get(businessId, groupId);
    await prisma.employeeGroupMember.createMany({
      data: employeeIds.map((employeeId) => ({ employeeId, groupId })),
      skipDuplicates: true,
    });
    return this.get(businessId, groupId);
  }

  async removeMembers(businessId: string, groupId: string, employeeIds: string[]) {
    await this.get(businessId, groupId);
    await prisma.employeeGroupMember.deleteMany({
      where: { groupId, employeeId: { in: employeeIds } },
    });
    return this.get(businessId, groupId);
  }

  async getAnalytics(businessId: string, groupId: string) {
    const group = await this.get(businessId, groupId);
    const memberIds = group.members.map((m) => m.employee.id);

    const [conversations, unread, broadcasts] = await Promise.all([
      prisma.employeeConversation.count({
        where: { businessId, employeeId: { in: memberIds } },
      }),
      prisma.employeeConversation.aggregate({
        where: { businessId, employeeId: { in: memberIds } },
        _sum: { unreadCount: true },
      }),
      prisma.employeeBroadcastRecipient.groupBy({
        by: ['status'],
        where: { employeeId: { in: memberIds }, broadcast: { businessId } },
        _count: true,
      }),
    ]);

    return {
      memberCount: group._count.members,
      conversationCount: conversations,
      unreadCount: unread._sum.unreadCount ?? 0,
      deliveryStats: broadcasts.map((b) => ({ status: b.status, count: b._count })),
    };
  }

  async getGroupInbox(businessId: string, groupId: string, limit = 50) {
    const group = await this.get(businessId, groupId);
    const memberIds = group.members.map((m) => m.employee.id);
    return prisma.employeeConversation.findMany({
      where: { businessId, employeeId: { in: memberIds }, isArchived: false },
      take: limit,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        employee: { select: { id: true, fullName: true, phone: true, department: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async exportGroup(businessId: string, groupId: string) {
    const group = await this.get(businessId, groupId);
    const rows = group.members.map((m) => ({
      'Full Name': m.employee.fullName,
      Phone: m.employee.phone,
      Department: m.employee.department ?? '',
      'Job Title': m.employee.jobTitle ?? '',
      Status: m.employee.status,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return { filename: `${group.name}-members.csv`, body: csv };
  }
}

export const employeeGroupsService = new EmployeeGroupsService();
