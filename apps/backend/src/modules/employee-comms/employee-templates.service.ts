import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../core/errors';
import type { CreateEmployeeTemplateInput, UpdateEmployeeTemplateInput } from '@smartreception/shared';

export class EmployeeTemplatesService {
  async list(businessId: string) {
    return prisma.employeeTemplate.findMany({
      where: { businessId },
      orderBy: { name: 'asc' },
    });
  }

  async create(businessId: string, input: CreateEmployeeTemplateInput) {
    return prisma.employeeTemplate.create({
      data: {
        businessId,
        name: input.name,
        content: input.content,
        category: input.category ?? 'GENERAL',
        variables: input.variables ?? [],
      },
    });
  }

  async update(businessId: string, id: string, input: UpdateEmployeeTemplateInput) {
    const tpl = await prisma.employeeTemplate.findFirst({ where: { id, businessId } });
    if (!tpl) throw new NotFoundError('Template not found');
    if (tpl.isSystem) throw new NotFoundError('System templates cannot be edited');
    return prisma.employeeTemplate.update({ where: { id }, data: input });
  }

  async delete(businessId: string, id: string) {
    const tpl = await prisma.employeeTemplate.findFirst({ where: { id, businessId } });
    if (!tpl) throw new NotFoundError('Template not found');
    if (tpl.isSystem) throw new NotFoundError('System templates cannot be deleted');
    await prisma.employeeTemplate.delete({ where: { id } });
  }
}

export const employeeTemplatesService = new EmployeeTemplatesService();
