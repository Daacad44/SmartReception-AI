import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError, ValidationError } from '../../core/errors';
import type { CreateEmployeeGroupInput, UpdateEmployeeGroupInput } from '@smartreception/shared';

export class EmployeeGroupsService {
  async list(businessId: string) {
    return prisma.employeeGroup.findMany({
      where: { businessId },
      include: { _count: { select: { members: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(businessId: string, input: CreateEmployeeGroupInput) {
    return prisma.employeeGroup.create({
      data: {
        businessId,
        name: input.name,
        description: input.description,
        color: input.color,
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
}

export const employeeGroupsService = new EmployeeGroupsService();
