import { prisma } from '../../infrastructure/database/prisma';
import { Prisma } from '@prisma/client';
import { PaginationInput } from '@smartreception/shared';

export class AppointmentsRepository {
  async findMany(
    businessId: string,
    params: PaginationInput & { status?: string; customerId?: string }
  ) {
    const { page, limit, search, sortBy, sortOrder, status, customerId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.AppointmentWhereInput = {
      businessId,
      ...(status && { status: status as Prisma.EnumAppointmentStatusFilter['equals'] }),
      ...(customerId && { customerId }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const orderBy: Prisma.AppointmentOrderByWithRelationInput = sortBy
      ? { [sortBy]: sortOrder }
      : { startTime: sortOrder };

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          customer: { select: { id: true, name: true, phone: true, email: true } },
          service: { select: { id: true, name: true, duration: true, price: true } },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    return { appointments, total, page, limit };
  }

  async findById(businessId: string, id: string) {
    return prisma.appointment.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        service: true,
      },
    });
  }

  async create(
    businessId: string,
    data: {
      customerId: string;
      serviceId?: string;
      title: string;
      description?: string;
      startTime: Date;
      endTime: Date;
      notes?: string;
    }
  ) {
    return prisma.appointment.create({
      data: {
        businessId,
        customerId: data.customerId,
        serviceId: data.serviceId,
        title: data.title,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes,
        status: 'SCHEDULED',
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: true,
      },
    });
  }

  async update(businessId: string, id: string, data: Prisma.AppointmentUpdateInput) {
    return prisma.appointment.update({
      where: { id, businessId },
      data,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: true,
      },
    });
  }

  async delete(businessId: string, id: string) {
    return prisma.appointment.update({
      where: { id, businessId },
      data: { status: 'CANCELLED' },
    });
  }

  async findCalendar(businessId: string, startDate: Date, endDate: Date) {
    return prisma.appointment.findMany({
      where: {
        businessId,
        startTime: { gte: startDate, lte: endDate },
        status: { notIn: ['CANCELLED'] },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true, duration: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findConflicts(businessId: string, startTime: Date, endTime: Date, excludeId?: string) {
    return prisma.appointment.findMany({
      where: {
        businessId,
        status: { notIn: ['CANCELLED'] },
        ...(excludeId && { id: { not: excludeId } }),
        OR: [
          { startTime: { gte: startTime, lt: endTime } },
          { endTime: { gt: startTime, lte: endTime } },
          { AND: [{ startTime: { lte: startTime } }, { endTime: { gte: endTime } }] },
        ],
      },
    });
  }
}

export const appointmentsRepository = new AppointmentsRepository();
