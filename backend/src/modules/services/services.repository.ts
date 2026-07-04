import { prisma } from '../../infrastructure/database/prisma';
import { Prisma } from '@prisma/client';
import { PaginationInput } from '@smartreception/shared';

export class ServicesRepository {
  async findMany(businessId: string, params: PaginationInput) {
    const { page, limit, search, sortBy, sortOrder } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceWhereInput = {
      businessId,
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.ServiceOrderByWithRelationInput = sortBy
      ? { [sortBy]: sortOrder }
      : { name: 'asc' };

    const [services, total] = await Promise.all([
      prisma.service.findMany({ where, skip, take: limit, orderBy }),
      prisma.service.count({ where }),
    ]);

    return { services, total, page, limit };
  }

  async findById(businessId: string, id: string) {
    return prisma.service.findFirst({
      where: { id, businessId, isActive: true },
    });
  }

  async create(
    businessId: string,
    data: {
      name: string;
      description?: string;
      duration: number;
      price?: number;
    }
  ) {
    return prisma.service.create({
      data: {
        businessId,
        name: data.name,
        description: data.description,
        duration: data.duration,
        price: data.price,
      },
    });
  }

  async update(businessId: string, id: string, data: Prisma.ServiceUpdateInput) {
    return prisma.service.update({
      where: { id, businessId },
      data,
    });
  }

  async softDelete(businessId: string, id: string) {
    return prisma.service.update({
      where: { id, businessId },
      data: { isActive: false },
    });
  }
}

export const servicesRepository = new ServicesRepository();
