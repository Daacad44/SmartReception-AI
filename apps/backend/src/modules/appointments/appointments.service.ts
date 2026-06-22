import { appointmentsRepository } from './appointments.repository';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors';
import {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  PaginationInput,
} from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';
import { notifyAppointment } from '../../infrastructure/notifications/notification-helper';
import {
  INVALID_EMAIL_MESSAGE,
  isValidEmail,
  normalizeEmail,
} from '../../infrastructure/appointments/email-validation';
import { scheduleAppointmentReminders } from '../../infrastructure/appointments/appointment-scheduler.service';
import { sendAppointmentConfirmation } from '../../infrastructure/appointments/appointment-notification.service';

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

  async getDetail(businessId: string, id: string) {
    const appointment = await appointmentsRepository.findDetail(businessId, id);
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const conversations = await prisma.conversation.findMany({
      where: { businessId, customerId: appointment.customerId },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 100 },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 5,
    });

    const auditEntries = await prisma.auditLog.findMany({
      where: { businessId, entity: 'Appointment', entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });

    return {
      ...appointment,
      communicationHistory: {
        whatsapp: conversations.flatMap((c) =>
          c.messages.map((m) => ({
            id: m.id,
            direction: m.direction,
            content: m.content,
            createdAt: m.createdAt,
            isAiGenerated: m.isAiGenerated,
            conversationId: c.id,
          }))
        ),
        activity: auditEntries,
      },
    };
  }

  async create(businessId: string, input: CreateAppointmentInput, userId: string) {
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, businessId, isActive: true },
    });
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const email = input.customerEmail || customer.email;
    if (!email || !isValidEmail(email)) {
      throw new ValidationError(INVALID_EMAIL_MESSAGE);
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

    if (input.customerEmail && input.customerEmail !== customer.email) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { email: normalizeEmail(input.customerEmail) },
      });
    }

    const appointment = await appointmentsRepository.create(businessId, {
      customerId: input.customerId,
      serviceId: input.serviceId,
      title: input.title,
      description: input.description,
      startTime,
      endTime,
      notes: input.notes,
      companyName: input.companyName,
      serviceRequested: input.serviceRequested,
      additionalNotes: input.additionalNotes,
      leadSource: input.leadSource || customer.source || 'WHATSAPP',
      assignedToId: input.assignedToId,
      meetingLink: input.meetingLink || undefined,
    });

    await scheduleAppointmentReminders({
      appointmentId: appointment.id,
      businessId,
      customerPhone: customer.phone,
      startTime,
    });

    void sendAppointmentConfirmation(appointment.id, businessId).catch(() => undefined);

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'CREATE',
        entity: 'Appointment',
        entityId: appointment.id,
      },
    });

    await notifyAppointment(
      businessId,
      'New appointment',
      `${input.title} scheduled for ${startTime.toLocaleDateString()}`,
      appointment.id
    );

    return appointment;
  }

  async update(businessId: string, id: string, input: UpdateAppointmentInput, userId: string) {
    const existing = await appointmentsRepository.findById(businessId, id);
    if (!existing) {
      throw new NotFoundError('Appointment not found');
    }

    if (input.customerEmail && !isValidEmail(input.customerEmail)) {
      throw new ValidationError(INVALID_EMAIL_MESSAGE);
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

    if (input.customerEmail && existing.customerId) {
      await prisma.customer.update({
        where: { id: existing.customerId },
        data: { email: normalizeEmail(input.customerEmail) },
      });
    }

    const appointment = await appointmentsRepository.update(businessId, id, {
      ...(input.customerId && { customer: { connect: { id: input.customerId } } }),
      ...(input.serviceId && { service: { connect: { id: input.serviceId } } }),
      ...(input.assignedToId && { assignedTo: { connect: { id: input.assignedToId } } }),
      title: input.title,
      description: input.description,
      startTime: input.startTime ? startTime : undefined,
      endTime: input.endTime ? endTime : undefined,
      notes: input.notes,
      companyName: input.companyName,
      serviceRequested: input.serviceRequested,
      additionalNotes: input.additionalNotes,
      leadSource: input.leadSource,
      meetingLink: input.meetingLink || undefined,
      ...(input.status && { status: input.status }),
    });

    if (input.startTime || input.endTime) {
      await scheduleAppointmentReminders({
        appointmentId: id,
        businessId,
        customerPhone: appointment.customer.phone,
        startTime,
      });
    }

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

    await notifyAppointment(
      businessId,
      'Appointment updated',
      `${appointment.title} was updated`,
      appointment.id,
      userId
    );

    return appointment;
  }

  async performAction(
    businessId: string,
    id: string,
    action: string,
    userId: string,
    data?: { assignedToId?: string; startTime?: string; endTime?: string; internalNote?: string }
  ) {
    const existing = await appointmentsRepository.findById(businessId, id);
    if (!existing) throw new NotFoundError('Appointment not found');

    let status = existing.status;
    const updateData: Record<string, unknown> = {};

    switch (action) {
      case 'approve':
        status = 'CONFIRMED';
        break;
      case 'cancel':
        status = 'CANCELLED';
        break;
      case 'complete':
        status = 'COMPLETED';
        break;
      case 'mark_missed':
        status = 'MISSED';
        updateData.missedAt = new Date();
        updateData.canRebookAfter = new Date(Date.now() + 24 * 60 * 60 * 1000);
        break;
      case 'assign':
        if (!data?.assignedToId) throw new ValidationError('assignedToId is required');
        updateData.assignedToId = data.assignedToId;
        break;
      case 'reschedule':
        if (!data?.startTime || !data?.endTime) {
          throw new ValidationError('startTime and endTime are required');
        }
        updateData.startTime = new Date(data.startTime);
        updateData.endTime = new Date(data.endTime);
        break;
      default:
        throw new ValidationError('Invalid action');
    }

    const appointment = await appointmentsRepository.update(businessId, id, {
      status,
      ...updateData,
    });

    if (data?.internalNote) {
      await prisma.appointmentInternalNote.create({
        data: { appointmentId: id, content: data.internalNote, createdById: userId },
      });
    }

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'UPDATE',
        entity: 'Appointment',
        entityId: id,
        newData: { action, ...data },
      },
    });

    return appointment;
  }

  async addInternalNote(businessId: string, id: string, content: string, userId: string) {
    const existing = await appointmentsRepository.findById(businessId, id);
    if (!existing) throw new NotFoundError('Appointment not found');

    return prisma.appointmentInternalNote.create({
      data: { appointmentId: id, content, createdById: userId },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
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

    await notifyAppointment(
      businessId,
      'Appointment cancelled',
      `${existing.title} was cancelled`,
      id,
      userId
    );
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
