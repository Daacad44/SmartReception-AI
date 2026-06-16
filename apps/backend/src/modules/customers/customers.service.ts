import { customersRepository } from './customers.repository';
import { ConflictError, NotFoundError } from '../../core/errors';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  PaginationInput,
} from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';

export class CustomersService {
  async list(businessId: string, params: PaginationInput & { tagId?: string }) {
    const result = await customersRepository.findMany(businessId, params);
    return {
      data: result.customers.map((c) => ({
        ...c,
        tags: c.tags.map((t) => t.tag),
      })),
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  async get(businessId: string, id: string) {
    const customer = await customersRepository.findById(businessId, id);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }
    return {
      ...customer,
      tags: customer.tags.map((t) => t.tag),
    };
  }

  async create(businessId: string, input: CreateCustomerInput, userId: string) {
    const existing = await customersRepository.findByPhone(businessId, input.phone);
    if (existing) {
      throw new ConflictError('Customer with this phone number already exists');
    }

    const customer = await customersRepository.create(businessId, {
      name: input.name,
      phone: input.phone,
      email: input.email || null,
      notes: input.notes,
      tagIds: input.tagIds,
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'CREATE',
        entity: 'Customer',
        entityId: customer.id,
      },
    });

    return customer;
  }

  async update(businessId: string, id: string, input: UpdateCustomerInput, userId: string) {
    const existing = await customersRepository.findById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Customer not found');
    }

    if (input.phone && input.phone !== existing.phone) {
      const phoneTaken = await customersRepository.findByPhone(businessId, input.phone);
      if (phoneTaken) {
        throw new ConflictError('Customer with this phone number already exists');
      }
    }

    const customer = await customersRepository.update(businessId, id, {
      name: input.name,
      phone: input.phone,
      email: input.email === '' ? null : input.email,
      notes: input.notes,
    });

    if (input.tagIds) {
      await customersRepository.assignTags(businessId, id, input.tagIds);
    }

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'UPDATE',
        entity: 'Customer',
        entityId: id,
        newData: input as object,
      },
    });

    return customer;
  }

  async delete(businessId: string, id: string, userId: string) {
    const existing = await customersRepository.findById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Customer not found');
    }

    await customersRepository.softDelete(businessId, id);

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'DELETE',
        entity: 'Customer',
        entityId: id,
      },
    });
  }

  async listTags(businessId: string) {
    return customersRepository.findTags(businessId);
  }

  async createTag(businessId: string, name: string, color?: string) {
    try {
      return await customersRepository.createTag(businessId, name, color);
    } catch {
      throw new ConflictError('Tag with this name already exists');
    }
  }

  async deleteTag(businessId: string, tagId: string) {
    try {
      await customersRepository.deleteTag(businessId, tagId);
    } catch {
      throw new NotFoundError('Tag not found');
    }
  }

  async assignTags(businessId: string, customerId: string, tagIds: string[]) {
    const customer = await customersRepository.findById(businessId, customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }
    const updated = await customersRepository.assignTags(businessId, customerId, tagIds);
    return { ...updated, tags: updated?.tags.map((t) => t.tag) };
  }

  async addNote(businessId: string, customerId: string, content: string, userId: string) {
    const customer = await customersRepository.findById(businessId, customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }
    return customersRepository.addNote(customerId, content, userId);
  }

  async getNotes(businessId: string, customerId: string) {
    const customer = await customersRepository.findById(businessId, customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }
    return customersRepository.getNotes(customerId);
  }
}

export const customersService = new CustomersService();
