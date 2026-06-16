import { appointmentsRepository } from './appointments.repository';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors';
import {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  PaginationInput,
} from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';
import { getReminderQueue } from '../../infrastructure/queue/queues';

export class AppointmentsService {
  async list(
    businessId: string,
    params: PaginationInput & { status?: string; customerId?: string }
  ) {
    const result = await appointmentsRepository.findMany(businessId, params);
    return {
      data: result.appointments,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  async get(businessId: string, id: string) {
    const appointment = await appointmentsRepository.findById(businessId, id);
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }
    return appointment;
  }

  async create(businessId: string, input: CreateAppointmentInput, userId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, businessId, isActive: true },
    });
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const startTime = new Date(input.startTime);
    const endTime = new Date(input.endTime);

    if (endTime <= startTime) {
      throw new ValidationError('End time must be after start time');
    }

    const conflicts = await appointmentsRepository.findConflicts(businessId, startTime, endTime);
    if (conflicts.length > 0) {
      throw new ConflictError('Time slot is not available');
    }

    const appointment = await appointmentsRepository.create(businessId, {
      customerId: input.customerId,
      serviceId: input.serviceId,
      title: input.title,
      description: input.description,
      startTime,
      endTime,
      notes: input.notes,
    });

    const reminderTime = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
    if (reminderTime > new Date()) {
      const queue = getReminderQueue();
      if (queue) {
        await queue.add(
          'appointment-reminder',
          {
            appointmentId: appointment.id,
            businessId,
            customerPhone: customer.phone,
          },
          { delay: reminderTime.getTime() - Date.now() }
        );
      }
    }

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'CREATE',
        entity: 'Appointment',
        entityId: appointment.id,
      },
    });

    return appointment;
  }

  async update(businessId: string, id: string, input: UpdateAppointmentInput, userId: string) {
    const existing = await appointmentsRepository.findById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Appointment not found');
    }

    const startTime = input.startTime ? new Date(input.startTime) : existing.startTime;
    const endTime = input.endTime ? new Date(input.endTime) : existing.endTime;

    if (endTime <= startTime) {
      throw new ValidationError('End time must be after start time');
    }

    if (input.startTime || input.endTime) {
      const conflicts = await appointmentsRepository.findConflicts(
        businessId,
        startTime,
        endTime,
        id
      );
      if (conflicts.length > 0) {
        throw new ConflictError('Time slot is not available');
      }
    }

    const appointment = await appointmentsRepository.update(businessId, id, {
      ...(input.customerId && { customer: { connect: { id: input.customerId } } }),
      ...(input.serviceId && { service: { connect: { id: input.serviceId } } }),
      title: input.title,
      description: input.description,
      startTime: input.startTime ? startTime : undefined,
      endTime: input.endTime ? endTime : undefined,
      notes: input.notes,
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'UPDATE',
        entity: 'Appointment',
        entityId: id,
        newData: input as object,
      },
    });

    return appointment;
  }

  async delete(businessId: string, id: string, userId: string) {
    const existing = await appointmentsRepository.findById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Appointment not found');
    }

    await appointmentsRepository.delete(businessId, id);

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'DELETE',
        entity: 'Appointment',
        entityId: id,
      },
    });
  }

  async getCalendar(businessId: string, startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ValidationError('Invalid date range');
    }

    return appointmentsRepository.findCalendar(businessId, start, end);
  }

  async checkAvailability(
    businessId: string,
    startTime: string,
    endTime: string,
    excludeId?: string
  ) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      throw new ValidationError('Invalid time range');
    }

    const conflicts = await appointmentsRepository.findConflicts(
      businessId,
      start,
      end,
      excludeId
    );

    return {
      available: conflicts.length === 0,
      conflicts: conflicts.map((c) => ({
        id: c.id,
        title: c.title,
        startTime: c.startTime,
        endTime: c.endTime,
      })),
    };
  }
}

export const appointmentsService = new AppointmentsService();
