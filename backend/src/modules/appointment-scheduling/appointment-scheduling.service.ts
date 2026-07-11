import type {
  UpdateAppointmentSettingsInput,
  BusinessExceptionInput,
  UpdateBusinessExceptionInput,
} from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../core/errors';
import {
  ensureAppointmentSettings,
  invalidateAppointmentSettingsCache,
  getDayAvailability,
  getUpcomingAvailability,
  getWorkingHoursSummary,
} from '../../infrastructure/appointments/appointment-availability.service';

function toDateOnly(value: string): Date {
  // Store calendar dates at UTC midnight so DATE columns are timezone-stable.
  return new Date(`${value}T00:00:00.000Z`);
}

export class AppointmentSchedulingService {
  getSettings(businessId: string) {
    return ensureAppointmentSettings(businessId);
  }

  async updateSettings(businessId: string, input: UpdateAppointmentSettingsInput) {
    await ensureAppointmentSettings(businessId);

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) data[key] = value;
    }

    const settings = await prisma.appointmentSettings.update({
      where: { businessId },
      data,
    });
    invalidateAppointmentSettingsCache(businessId);
    return settings;
  }

  listExceptions(businessId: string) {
    return prisma.businessException.findMany({
      where: { businessId },
      orderBy: { startDate: 'asc' },
    });
  }

  async createException(businessId: string, input: BusinessExceptionInput) {
    const exception = await prisma.businessException.create({
      data: {
        businessId,
        title: input.title,
        type: input.type,
        startDate: toDateOnly(input.startDate),
        endDate: input.endDate ? toDateOnly(input.endDate) : null,
        isClosed: input.isClosed ?? true,
        openTime: input.openTime ?? null,
        closeTime: input.closeTime ?? null,
        note: input.note ?? null,
      },
    });
    invalidateAppointmentSettingsCache(businessId);
    return exception;
  }

  async updateException(businessId: string, id: string, input: UpdateBusinessExceptionInput) {
    const existing = await prisma.businessException.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError('Exception not found');

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.type !== undefined) data.type = input.type;
    if (input.startDate !== undefined) data.startDate = toDateOnly(input.startDate);
    if (input.endDate !== undefined) data.endDate = input.endDate ? toDateOnly(input.endDate) : null;
    if (input.isClosed !== undefined) data.isClosed = input.isClosed;
    if (input.openTime !== undefined) data.openTime = input.openTime;
    if (input.closeTime !== undefined) data.closeTime = input.closeTime;
    if (input.note !== undefined) data.note = input.note;

    const exception = await prisma.businessException.update({ where: { id }, data });
    invalidateAppointmentSettingsCache(businessId);
    return exception;
  }

  async deleteException(businessId: string, id: string) {
    const existing = await prisma.businessException.findFirst({ where: { id, businessId } });
    if (!existing) throw new NotFoundError('Exception not found');
    await prisma.businessException.delete({ where: { id } });
    invalidateAppointmentSettingsCache(businessId);
  }

  getDay(businessId: string, date: string) {
    return getDayAvailability(businessId, date);
  }

  getUpcoming(businessId: string, days: number) {
    return getUpcomingAvailability(businessId, days);
  }

  getWorkingHours(businessId: string) {
    return getWorkingHoursSummary(businessId);
  }
}

export const appointmentSchedulingService = new AppointmentSchedulingService();
