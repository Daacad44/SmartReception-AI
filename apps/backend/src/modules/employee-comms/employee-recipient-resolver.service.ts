import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../core/errors';
import type { Prisma } from '@prisma/client';

export type EmployeeAudienceFilter = {
  department?: string;
  branch?: string;
  status?: string;
  role?: string;
  roles?: string[];
  tags?: string[];
  groupIds?: string[];
  employeeIds?: string[];
  logic?: 'AND' | 'OR';
};

export type ResolveRecipientsInput = {
  sendToAll?: boolean;
  groupId?: string | null;
  groupIds?: string[];
  department?: string | null;
  branch?: string | null;
  roles?: string[];
  tags?: string[];
  employeeIds?: string[];
  audienceFilter?: EmployeeAudienceFilter | null;
};

function activeEmployeeWhere(businessId: string): Prisma.EmployeeWhereInput {
  return { businessId, isActive: true, status: 'ACTIVE' };
}

function applyAudienceFilter(
  base: Prisma.EmployeeWhereInput,
  filter: EmployeeAudienceFilter
): Prisma.EmployeeWhereInput {
  const conditions: Prisma.EmployeeWhereInput[] = [];

  if (filter.department) conditions.push({ department: filter.department });
  if (filter.branch) conditions.push({ branch: filter.branch });
  if (filter.status) conditions.push({ status: filter.status as never });
  if (filter.role) conditions.push({ role: filter.role });
  if (filter.roles?.length) conditions.push({ role: { in: filter.roles } });
  if (filter.tags?.length) conditions.push({ tags: { hasSome: filter.tags } });
  if (filter.groupIds?.length) {
    conditions.push({ groupMembers: { some: { groupId: { in: filter.groupIds } } } });
  }
  if (filter.employeeIds?.length) conditions.push({ id: { in: filter.employeeIds } });

  if (!conditions.length) return base;

  if (filter.logic === 'OR') {
    return { ...base, OR: conditions };
  }
  return { ...base, AND: conditions };
}

export async function resolveEmployeeRecipients(
  businessId: string,
  options: ResolveRecipientsInput
) {
  const {
    sendToAll,
    groupId,
    groupIds,
    department,
    branch,
    roles,
    tags,
    employeeIds,
    audienceFilter,
  } = options;

  if (audienceFilter && Object.keys(audienceFilter).length > 0) {
    const where = applyAudienceFilter(activeEmployeeWhere(businessId), audienceFilter);
    return prisma.employee.findMany({ where, orderBy: { fullName: 'asc' } });
  }

  if (employeeIds?.length) {
    return prisma.employee.findMany({
      where: { ...activeEmployeeWhere(businessId), id: { in: employeeIds } },
      orderBy: { fullName: 'asc' },
    });
  }

  if (sendToAll) {
    return prisma.employee.findMany({
      where: activeEmployeeWhere(businessId),
      orderBy: { fullName: 'asc' },
    });
  }

  const allGroupIds = [...(groupIds ?? []), ...(groupId ? [groupId] : [])].filter(Boolean);
  if (allGroupIds.length) {
    const groups = await prisma.employeeGroup.findMany({
      where: { businessId, id: { in: allGroupIds }, status: 'ACTIVE', archivedAt: null },
      include: { members: { include: { employee: true } } },
    });
    if (!groups.length) throw new NotFoundError('Employee group not found');

    const employeeMap = new Map<string, (typeof groups)[0]['members'][0]['employee']>();
    for (const group of groups) {
      for (const member of group.members) {
        const e = member.employee;
        if (e.isActive && e.status === 'ACTIVE') employeeMap.set(e.id, e);
      }
    }
    return Array.from(employeeMap.values());
  }

  const where: Prisma.EmployeeWhereInput = {
    ...activeEmployeeWhere(businessId),
    ...(department && { department }),
    ...(branch && { branch }),
    ...(roles?.length && { role: { in: roles } }),
    ...(tags?.length && { tags: { hasSome: tags } }),
  };

  return prisma.employee.findMany({ where, orderBy: { fullName: 'asc' } });
}

export async function previewEmployeeRecipients(
  businessId: string,
  options: ResolveRecipientsInput
) {
  const employees = await resolveEmployeeRecipients(businessId, options);
  return {
    count: employees.length,
    preview: employees.slice(0, 50).map((e) => ({
      id: e.id,
      fullName: e.fullName,
      phone: e.phone,
      department: e.department,
      branch: e.branch,
      role: e.role,
    })),
  };
}
