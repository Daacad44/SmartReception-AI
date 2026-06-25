import { servicesRepository } from './services.repository';
import { NotFoundError } from '../../core/errors';
import { CreateServiceInput, PaginationInput } from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';
import { invalidateBusinessTenantCache } from '../../infrastructure/ai/business-tenant-cache.service';

export class ServicesService {
  async list(businessId: string, params: PaginationInput) {
    const result = await servicesRepository.findMany(businessId, params);
    return {
      data: result.services,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  async get(businessId: string, id: string) {
    const service = await servicesRepository.findById(businessId, id);
    if (!service) {
      throw new NotFoundError('Service not found');
    }
    return service;
  }

  async create(businessId: string, input: CreateServiceInput, userId: string) {
    const service = await servicesRepository.create(businessId, {
      name: input.name,
      description: input.description,
      duration: input.duration,
      price: input.price,
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'CREATE',
        entity: 'Service',
        entityId: service.id,
      },
    });

    invalidateBusinessTenantCache(businessId);
    return service;
  }

  async update(
    businessId: string,
    id: string,
    input: Partial<CreateServiceInput>,
    userId: string
  ) {
    const existing = await servicesRepository.findById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Service not found');
    }

    const service = await servicesRepository.update(businessId, id, {
      name: input.name,
      description: input.description,
      duration: input.duration,
      price: input.price,
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'UPDATE',
        entity: 'Service',
        entityId: id,
        newData: input as object,
      },
    });

    invalidateBusinessTenantCache(businessId);
    return service;
  }

  async delete(businessId: string, id: string, userId: string) {
    const existing = await servicesRepository.findById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Service not found');
    }

    await servicesRepository.softDelete(businessId, id);

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'DELETE',
        entity: 'Service',
        entityId: id,
      },
    });

    invalidateBusinessTenantCache(businessId);
  }
}

export const servicesService = new ServicesService();
