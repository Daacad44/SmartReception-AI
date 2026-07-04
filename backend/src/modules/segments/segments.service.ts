import { prisma } from '../../infrastructure/database/prisma';
import { ConflictError, NotFoundError } from '../../core/errors';
import { CreateSegmentInput, UpdateSegmentInput } from '@smartreception/shared';
import type { CustomerType } from '@prisma/client';

const SYSTEM_SEGMENTS: Array<{ name: string; customerType: CustomerType; color: string }> = [
  { name: 'VIP Customers', customerType: 'VIP', color: '#D97706' },
  { name: 'Regular Customers', customerType: 'REGULAR', color: '#1E3A5F' },
  { name: 'New Customers', customerType: 'NEW_CUSTOMER', color: '#10B981' },
  { name: 'Returning Customers', customerType: 'RETURNING', color: '#3B82F6' },
  { name: 'Premium Customers', customerType: 'PREMIUM', color: '#7C3AED' },
  { name: 'High Value Customers', customerType: 'HIGH_VALUE', color: '#8B5CF6' },
  { name: 'Inactive Customers', customerType: 'INACTIVE', color: '#6B7280' },
  { name: 'Leads', customerType: 'LEAD', color: '#F59E0B' },
  { name: 'Prospects', customerType: 'PROSPECT', color: '#EC4899' },
];

export class SegmentsService {
  async ensureSystemSegments(businessId: string): Promise<void> {
    for (const seg of SYSTEM_SEGMENTS) {
      await prisma.customerSegment.upsert({
        where: { businessId_name: { businessId, name: seg.name } },
        create: {
          businessId,
          name: seg.name,
          customerType: seg.customerType,
          color: seg.color,
          isSystem: true,
          description: `System segment for ${seg.name}`,
        },
        update: { customerType: seg.customerType, color: seg.color, isSystem: true },
      });
    }
  }

  async list(businessId: string) {
    await this.ensureSystemSegments(businessId);
    const segments = await prisma.customerSegment.findMany({
      where: { businessId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { members: true, campaigns: true } },
      },
    });

    const typeCounts = await prisma.customer.groupBy({
      by: ['customerType'],
      where: { businessId, isActive: true },
      _count: { id: true },
    });
    const countMap = Object.fromEntries(typeCounts.map((t) => [t.customerType, t._count.id]));

    return segments.map((s) => ({
      ...s,
      memberCount: s.customerType
        ? countMap[s.customerType] ?? 0
        : s._count.members,
    }));
  }

  async get(businessId: string, id: string) {
    const segment = await prisma.customerSegment.findFirst({
      where: { id, businessId },
      include: {
        members: {
          include: {
            customer: {
              select: { id: true, name: true, phone: true, email: true, customerType: true },
            },
          },
        },
      },
    });
    if (!segment) throw new NotFoundError('Segment not found');
    return segment;
  }

  async create(businessId: string, input: CreateSegmentInput, userId: string) {
    const existing = await prisma.customerSegment.findFirst({
      where: { businessId, name: input.name },
    });
    if (existing) throw new ConflictError('Segment with this name already exists');

    const segment = await prisma.customerSegment.create({
      data: {
        businessId,
        name: input.name,
        description: input.description,
        color: input.color || '#D97706',
        customerType: input.customerType,
        isSystem: false,
        ...(input.customerIds?.length && {
          members: {
            create: input.customerIds.map((customerId) => ({ customerId })),
          },
        }),
      },
      include: { _count: { select: { members: true } } },
    });

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'CREATE', entity: 'CustomerSegment', entityId: segment.id },
    });

    return segment;
  }

  async update(businessId: string, id: string, input: UpdateSegmentInput, userId: string) {
    const existing = await prisma.customerSegment.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError('Segment not found');
    if (existing.isSystem && input.name) throw new ConflictError('Cannot rename system segments');

    const segment = await prisma.customerSegment.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        color: input.color,
        customerType: input.customerType,
      },
    });

    if (input.customerIds) {
      await prisma.customerSegmentMember.deleteMany({ where: { segmentId: id } });
      if (input.customerIds.length > 0) {
        await prisma.customerSegmentMember.createMany({
          data: input.customerIds.map((customerId) => ({ segmentId: id, customerId })),
          skipDuplicates: true,
        });
      }
    }

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'UPDATE', entity: 'CustomerSegment', entityId: id, newData: input as object },
    });

    return segment;
  }

  async delete(businessId: string, id: string, userId: string) {
    const existing = await prisma.customerSegment.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError('Segment not found');
    if (existing.isSystem) throw new ConflictError('Cannot delete system segments');

    await prisma.customerSegment.delete({ where: { id } });

    await prisma.auditLog.create({
      data: { businessId, userId, action: 'DELETE', entity: 'CustomerSegment', entityId: id },
    });
  }

  async addMembers(businessId: string, segmentId: string, customerIds: string[], userId: string) {
    const segment = await prisma.customerSegment.findFirst({ where: { id: segmentId, businessId } });
    if (!segment) throw new NotFoundError('Segment not found');
    if (segment.isSystem) throw new ConflictError('Use customer type for system segments');

    await prisma.customerSegmentMember.createMany({
      data: customerIds.map((customerId) => ({ segmentId, customerId })),
      skipDuplicates: true,
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'UPDATE',
        entity: 'CustomerSegment',
        entityId: segmentId,
        newData: { addedMembers: customerIds },
      },
    });
  }
}

export const segmentsService = new SegmentsService();
