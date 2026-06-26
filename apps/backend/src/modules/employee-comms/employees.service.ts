import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../core/errors';
import type { Prisma } from '@prisma/client';
import { assertEmployeeCreateAllowed } from './employee-limits.service';
import type { CreateEmployeeInput, UpdateEmployeeInput, PaginationInput } from '@smartreception/shared';

export class EmployeesService {
  async list(
    businessId: string,
    params: PaginationInput & {
      department?: string;
      branch?: string;
      status?: string;
      groupId?: string;
    }
  ) {
    const { page, limit, search, sortBy, sortOrder, department, branch, status, groupId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.EmployeeWhereInput = {
      businessId,
      isActive: true,
      ...(department && { department }),
      ...(branch && { branch }),
      ...(status && { status: status as never }),
      ...(groupId && { groupMembers: { some: { groupId } } }),
      ...(search && {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
          { jobTitle: { contains: search, mode: 'insensitive' } },
          { department: { contains: search, mode: 'insensitive' } },
          { employeeCode: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.EmployeeOrderByWithRelationInput = sortBy
      ? { [sortBy]: sortOrder }
      : { createdAt: sortOrder };

    const [data, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          manager: { select: { id: true, fullName: true } },
          groupMembers: { include: { group: { select: { id: true, name: true } } } },
        },
      }),
      prisma.employee.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async get(businessId: string, id: string) {
    const employee = await prisma.employee.findFirst({
      where: { id, businessId, isActive: true },
      include: {
        manager: { select: { id: true, fullName: true } },
        directReports: { select: { id: true, fullName: true, jobTitle: true } },
        groupMembers: { include: { group: true } },
      },
    });
    if (!employee) throw new NotFoundError('Employee not found');
    return employee;
  }

  async create(businessId: string, input: CreateEmployeeInput) {
    await assertEmployeeCreateAllowed(businessId);
    const employee = await prisma.employee.create({
      data: {
        businessId,
        employeeCode: input.employeeCode,
        fullName: input.fullName,
        jobTitle: input.jobTitle,
        department: input.department,
        role: input.role,
        phone: input.phone,
        whatsappNumber: input.whatsappNumber || input.phone,
        email: input.email || null,
        status: input.status ?? 'ACTIVE',
        profilePhotoUrl: input.profilePhotoUrl,
        branch: input.branch,
        managerId: input.managerId,
        hireDate: input.hireDate ? new Date(input.hireDate) : null,
        employmentType: input.employmentType ?? 'FULL_TIME',
        language: input.language ?? 'so',
        timezone: input.timezone,
        groupMembers: input.groupIds?.length
          ? { create: input.groupIds.map((groupId) => ({ groupId })) }
          : undefined,
      },
      include: { groupMembers: { include: { group: true } } },
    });
    return employee;
  }

  async update(businessId: string, id: string, input: UpdateEmployeeInput) {
    await this.get(businessId, id);
    if (input.groupIds) {
      await prisma.employeeGroupMember.deleteMany({ where: { employeeId: id } });
      if (input.groupIds.length) {
        await prisma.employeeGroupMember.createMany({
          data: input.groupIds.map((groupId) => ({ employeeId: id, groupId })),
        });
      }
    }
    return prisma.employee.update({
      where: { id },
      data: {
        employeeCode: input.employeeCode,
        fullName: input.fullName,
        jobTitle: input.jobTitle,
        department: input.department,
        role: input.role,
        phone: input.phone,
        whatsappNumber: input.whatsappNumber,
        email: input.email,
        status: input.status as never,
        profilePhotoUrl: input.profilePhotoUrl,
        branch: input.branch,
        managerId: input.managerId,
        hireDate: input.hireDate ? new Date(input.hireDate) : undefined,
        employmentType: input.employmentType as never,
        language: input.language,
        timezone: input.timezone,
      },
      include: { groupMembers: { include: { group: true } } },
    });
  }

  async softDelete(businessId: string, id: string) {
    await this.get(businessId, id);
    return prisma.employee.update({
      where: { id },
      data: { isActive: false, status: 'TERMINATED' },
    });
  }
}

export const employeesService = new EmployeesService();
