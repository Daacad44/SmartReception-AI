import { prisma } from '../../infrastructure/database/prisma';
import { Customer, Prisma } from '@prisma/client';
import { PaginationInput } from '@smartreception/shared';

export class CustomersRepository {
  async findMany(businessId: string, params: PaginationInput & { tagId?: string }) {
    const { page, limit, search, sortBy, sortOrder, tagId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {
      businessId,
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(tagId && {
        tags: { some: { tagId } },
      }),
    };

    const orderBy: Prisma.CustomerOrderByWithRelationInput = sortBy
      ? { [sortBy]: sortOrder }
      : { createdAt: sortOrder };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          tags: { include: { tag: true } },
          _count: { select: { conversations: true, appointments: true } },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    return { customers, total, page, limit };
  }

  async findById(businessId: string, id: string) {
    return prisma.customer.findFirst({
      where: { id, businessId, isActive: true },
      include: {
        tags: { include: { tag: true } },
        customerNotes: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { conversations: true, appointments: true } },
      },
    });
  }

  async create(
    businessId: string,
    data: {
      name: string;
      phone: string;
      email?: string | null;
      notes?: string | null;
      companyName?: string | null;
      whatsappNumber?: string | null;
      customerType?: string;
      leadStatus?: string;
      customerValue?: number;
      tagIds?: string[];
    }
  ): Promise<Customer> {
    return prisma.customer.create({
      data: {
        businessId,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        notes: data.notes,
        companyName: data.companyName,
        whatsappNumber: data.whatsappNumber || data.phone,
        customerType: data.customerType as never,
        leadStatus: data.leadStatus as never,
        customerValue: data.customerValue,
        tags: data.tagIds?.length
          ? { create: data.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
      },
      include: { tags: { include: { tag: true } } },
    });
  }

  async update(
    businessId: string,
    id: string,
    data: Prisma.CustomerUpdateInput
  ): Promise<Customer> {
    return prisma.customer.update({
      where: { id, businessId },
      data,
      include: { tags: { include: { tag: true } } },
    });
  }

  async softDelete(businessId: string, id: string): Promise<Customer> {
    return prisma.customer.update({
      where: { id, businessId },
      data: { isActive: false },
    });
  }

  async findTags(businessId: string) {
    return prisma.customerTag.findMany({
      where: { businessId },
      include: { _count: { select: { customers: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createTag(businessId: string, name: string, color?: string) {
    return prisma.customerTag.create({
      data: { businessId, name, color: color || '#651147' },
    });
  }

  async deleteTag(businessId: string, tagId: string) {
    return prisma.customerTag.delete({
      where: { id: tagId, businessId },
    });
  }

  async assignTags(businessId: string, customerId: string, tagIds: string[]) {
    await prisma.customerTagAssignment.deleteMany({
      where: { customerId, tag: { businessId } },
    });
    if (tagIds.length > 0) {
      await prisma.customerTagAssignment.createMany({
        data: tagIds.map((tagId) => ({ customerId, tagId })),
        skipDuplicates: true,
      });
    }
    return this.findById(businessId, customerId);
  }

  async addNote(customerId: string, content: string, createdBy?: string) {
    return prisma.customerNote.create({
      data: { customerId, content, createdBy },
    });
  }

  async getNotes(customerId: string) {
    return prisma.customerNote.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByPhone(businessId: string, phone: string) {
    return prisma.customer.findUnique({
      where: { businessId_phone: { businessId, phone } },
    });
  }
}

export const customersRepository = new CustomersRepository();
