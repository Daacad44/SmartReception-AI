import type { AppointmentSettings, BusinessException } from '@prisma/client';
import { defaultWeeklyHours, type DayHours, type WeeklyHours } from '@smartreception/shared';
import { prisma } from '../database/prisma';
import { ConflictError, ValidationError } from '../../core/errors';
import { logger } from '../../core/logger';
import {
  formatDateInTz,
  formatTimeInTz,
  minutesToTime,
  timeToMinutes,
  to12Hour,
  weekdayKeyForDate,
  zonedWallTimeToUtc,
} from './timezone.util';

export interface AppointmentSlot {
  start: string; // ISO UTC
  end: string; // ISO UTC
  time: string; // 'HH:MM' local
  label: string; // '9:00 AM' local
}

export interface DayAvailability {
  date: string; // 'YYYY-MM-DD'
  weekday: string;
  isOpen: boolean;
  reason?: string; // why closed / special
  openTime?: string;
  closeTime?: string;
  slots: AppointmentSlot[];
}

interface EffectiveDay {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  reason?: string;
}

const settingsCache = new Map<string, { settings: AppointmentSettings; loadedAt: number }>();
const CACHE_TTL_MS = 60_000;

export function invalidateAppointmentSettingsCache(businessId: string): void {
  settingsCache.delete(businessId);
}

function asWeeklyHours(value: unknown): WeeklyHours {
  if (value && typeof value === 'object') {
    return value as WeeklyHours;
  }
  return defaultWeeklyHours();
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Ensure an AppointmentSettings row exists, seeded from the business timezone. */
export async function ensureAppointmentSettings(businessId: string): Promise<AppointmentSettings> {
  const cached = settingsCache.get(businessId);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.settings;
  }

  let settings = await prisma.appointmentSettings.findUnique({ where: { businessId } });
  if (!settings) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { timezone: true },
    });
    settings = await prisma.appointmentSettings.create({
      data: {
        businessId,
        timezone: normalizeTimezone(business?.timezone),
        weeklyHours: defaultWeeklyHours() as object,
      },
    });
  }

  settingsCache.set(businessId, { settings, loadedAt: Date.now() });
  return settings;
}

function normalizeTimezone(tz?: string | null): string {
  if (!tz || tz === 'UTC') return 'Africa/Mogadishu';
  return tz;
}

async function getExceptions(businessId: string): Promise<BusinessException[]> {
  return prisma.businessException.findMany({
    where: { businessId },
    orderBy: { startDate: 'asc' },
  });
}

/** Resolve the effective open/closed hours for a specific calendar date. */
function resolveEffectiveDay(
  dateStr: string,
  settings: AppointmentSettings,
  exceptions: BusinessException[]
): EffectiveDay {
  const weekly = asWeeklyHours(settings.weeklyHours);
  const key = weekdayKeyForDate(dateStr);
  const base: DayHours = weekly[key] ?? { isOpen: false, openTime: '09:00', closeTime: '18:00' };

  const blocked = asStringArray(settings.blockedDates);
  if (blocked.includes(dateStr)) {
    return { isOpen: false, openTime: base.openTime, closeTime: base.closeTime, reason: 'Blocked date' };
  }

  for (const ex of exceptions) {
    const start = formatDateInTz(ex.startDate, 'UTC');
    const end = ex.endDate ? formatDateInTz(ex.endDate, 'UTC') : start;
    if (dateStr >= start && dateStr <= end) {
      if (ex.isClosed) {
        return { isOpen: false, openTime: base.openTime, closeTime: base.closeTime, reason: ex.title };
      }
      if (ex.openTime && ex.closeTime) {
        return {
          isOpen: true,
          openTime: ex.openTime,
          closeTime: ex.closeTime,
          breakStart: null,
          breakEnd: null,
          reason: ex.title,
        };
      }
    }
  }

  return {
    isOpen: base.isOpen,
    openTime: base.openTime,
    closeTime: base.closeTime,
    breakStart: base.breakStart ?? null,
    breakEnd: base.breakEnd ?? null,
  };
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Generate the concrete available slots for one date in the business timezone. */
export async function getDayAvailability(
  businessId: string,
  dateStr: string,
  now: Date = new Date()
): Promise<DayAvailability> {
  const settings = await ensureAppointmentSettings(businessId);
  const tz = normalizeTimezone(settings.timezone);
  const exceptions = await getExceptions(businessId);
  const day = resolveEffectiveDay(dateStr, settings, exceptions);
  const weekday = weekdayKeyForDate(dateStr);

  const base: DayAvailability = {
    date: dateStr,
    weekday,
    isOpen: day.isOpen,
    reason: day.reason,
    openTime: day.isOpen ? day.openTime : undefined,
    closeTime: day.isOpen ? day.closeTime : undefined,
    slots: [],
  };

  if (!day.isOpen) return base;

  const [y, m, d] = dateStr.split('-').map(Number);
  const duration = settings.slotDurationMinutes;
  const openMin = timeToMinutes(day.openTime);
  const closeMin = timeToMinutes(day.closeTime);
  const breakStartMin = day.breakStart ? timeToMinutes(day.breakStart) : null;
  const breakEndMin = day.breakEnd ? timeToMinutes(day.breakEnd) : null;

  // Existing bookings for the day (padded UTC window), expanded by buffers.
  const windowStart = zonedWallTimeToUtc(y!, m!, d!, 0, 0, tz);
  const windowEnd = new Date(windowStart.getTime() + 26 * 60 * 60 * 1000);
  const existing = await prisma.appointment.findMany({
    where: {
      businessId,
      status: { notIn: ['CANCELLED', 'MISSED', 'NO_SHOW', 'REJECTED', 'EXPIRED'] },
      startTime: { gte: windowStart, lt: windowEnd },
    },
    select: { startTime: true, endTime: true },
  });

  const sameDayBookings = existing.filter((a) => formatDateInTz(a.startTime, tz) === dateStr);
  if (settings.maxDailyBookings != null && sameDayBookings.length >= settings.maxDailyBookings) {
    return { ...base, reason: 'Fully booked', slots: [] };
  }

  const busy = existing.map((a) => ({
    start: a.startTime.getTime() - settings.bufferBeforeMinutes * 60000,
    end: a.endTime.getTime() + settings.bufferAfterMinutes * 60000,
  }));

  const unavailable = Array.isArray(settings.unavailableSlots)
    ? (settings.unavailableSlots as Array<{ date: string; start: string; end: string }>)
    : [];
  const dayUnavailable = unavailable
    .filter((u) => u && u.date === dateStr)
    .map((u) => ({ start: timeToMinutes(u.start), end: timeToMinutes(u.end) }));

  const earliestMs = now.getTime() + settings.minNoticeMinutes * 60000;
  const slots: AppointmentSlot[] = [];

  for (let startM = openMin; startM + duration <= closeMin; startM += duration) {
    const endM = startM + duration;

    // Skip lunch/break window.
    if (breakStartMin != null && breakEndMin != null && overlaps(startM, endM, breakStartMin, breakEndMin)) {
      continue;
    }
    // Skip configured unavailable ranges.
    if (dayUnavailable.some((u) => overlaps(startM, endM, u.start, u.end))) {
      continue;
    }

    const startDate = zonedWallTimeToUtc(y!, m!, d!, Math.floor(startM / 60), startM % 60, tz);
    const endDate = new Date(startDate.getTime() + duration * 60000);

    // Respect minimum notice / no past bookings.
    if (startDate.getTime() < earliestMs) continue;

    // Skip if it collides with an existing booking (buffers included).
    if (busy.some((b) => overlaps(startDate.getTime(), endDate.getTime(), b.start, b.end))) {
      continue;
    }

    const time = minutesToTime(startM);
    slots.push({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      time,
      label: to12Hour(time),
    });
  }

  return { ...base, slots };
}

/** Upcoming availability across the next `days`, capped by maxAdvanceDays. */
export async function getUpcomingAvailability(
  businessId: string,
  days = 7,
  now: Date = new Date()
): Promise<DayAvailability[]> {
  const settings = await ensureAppointmentSettings(businessId);
  const tz = normalizeTimezone(settings.timezone);
  const horizon = Math.min(days, settings.maxAdvanceDays);
  const todayStr = formatDateInTz(now, tz);
  const [ty, tm, td] = todayStr.split('-').map(Number);

  const result: DayAvailability[] = [];
  for (let i = 0; i < horizon; i += 1) {
    if (i === 0 && !settings.allowSameDay) continue;
    const cursor = new Date(Date.UTC(ty!, tm! - 1, td! + i, 12));
    const dateStr = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`;
    result.push(await getDayAvailability(businessId, dateStr, now));
  }
  return result;
}

/**
 * Validate a proposed booking against every rule: no past bookings, minimum
 * notice, business open, within working hours, not during a break, and no
 * double-booking. Throws ValidationError / ConflictError on failure.
 */
export async function validateBookingTime(
  businessId: string,
  start: Date,
  end: Date,
  excludeId?: string,
  now: Date = new Date()
): Promise<void> {
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ValidationError('Invalid appointment time');
  }
  if (end <= start) {
    throw new ValidationError('End time must be after start time');
  }

  const settings = await ensureAppointmentSettings(businessId);
  const tz = normalizeTimezone(settings.timezone);

  if (start.getTime() < now.getTime()) {
    throw new ValidationError('Cannot book an appointment in the past');
  }
  if (start.getTime() < now.getTime() + settings.minNoticeMinutes * 60000) {
    throw new ValidationError(
      `Appointments require at least ${settings.minNoticeMinutes} minutes advance notice`
    );
  }
  const maxAdvanceMs = settings.maxAdvanceDays * 24 * 60 * 60 * 1000;
  if (start.getTime() > now.getTime() + maxAdvanceMs) {
    throw new ValidationError(
      `Appointments can only be booked up to ${settings.maxAdvanceDays} days in advance`
    );
  }

  const dateStr = formatDateInTz(start, tz);
  const exceptions = await getExceptions(businessId);
  const day = resolveEffectiveDay(dateStr, settings, exceptions);
  if (!day.isOpen) {
    throw new ValidationError(day.reason ? `Closed: ${day.reason}` : 'Business is closed on this day');
  }

  const startMin = timeToMinutes(formatTimeInTz(start, tz));
  const endMin = timeToMinutes(formatTimeInTz(end, tz));
  const openMin = timeToMinutes(day.openTime);
  const closeMin = timeToMinutes(day.closeTime);
  if (startMin < openMin || endMin > closeMin || endMin <= startMin) {
    throw new ValidationError(
      `Outside working hours (${to12Hour(day.openTime)} – ${to12Hour(day.closeTime)})`
    );
  }
  if (day.breakStart && day.breakEnd) {
    const bs = timeToMinutes(day.breakStart);
    const be = timeToMinutes(day.breakEnd);
    if (overlaps(startMin, endMin, bs, be)) {
      throw new ValidationError(`Overlaps the daily break (${to12Hour(day.breakStart)} – ${to12Hour(day.breakEnd)})`);
    }
  }

  // Double-booking check with buffers.
  const bufStart = new Date(start.getTime() - settings.bufferBeforeMinutes * 60000);
  const bufEnd = new Date(end.getTime() + settings.bufferAfterMinutes * 60000);
  const conflicts = await prisma.appointment.findMany({
    where: {
      businessId,
      status: { notIn: ['CANCELLED', 'MISSED', 'NO_SHOW', 'REJECTED', 'EXPIRED'] },
      ...(excludeId && { id: { not: excludeId } }),
      startTime: { lt: bufEnd },
      endTime: { gt: bufStart },
    },
    select: { id: true },
  });
  if (conflicts.length > 0) {
    throw new ConflictError('This time slot is no longer available');
  }

  // Daily cap.
  if (settings.maxDailyBookings != null) {
    const dayStart = zonedWallTimeToUtc(
      Number(dateStr.slice(0, 4)),
      Number(dateStr.slice(5, 7)),
      Number(dateStr.slice(8, 10)),
      0,
      0,
      tz
    );
    const dayEnd = new Date(dayStart.getTime() + 26 * 60 * 60 * 1000);
    const count = await prisma.appointment.count({
      where: {
        businessId,
        status: { notIn: ['CANCELLED', 'MISSED', 'NO_SHOW', 'REJECTED', 'EXPIRED'] },
        ...(excludeId && { id: { not: excludeId } }),
        startTime: { gte: dayStart, lt: dayEnd },
      },
    });
    if (count >= settings.maxDailyBookings) {
      throw new ConflictError('The daily booking limit for this day has been reached');
    }
  }
}

/** Human-readable weekly hours + timezone, used for AI "what are your hours?" answers. */
export async function getWorkingHoursSummary(businessId: string): Promise<string> {
  const settings = await ensureAppointmentSettings(businessId);
  const weekly = asWeeklyHours(settings.weeklyHours);
  const order: Array<[keyof WeeklyHours, string]> = [
    ['monday', 'Monday'],
    ['tuesday', 'Tuesday'],
    ['wednesday', 'Wednesday'],
    ['thursday', 'Thursday'],
    ['friday', 'Friday'],
    ['saturday', 'Saturday'],
    ['sunday', 'Sunday'],
  ];
  const lines = order.map(([key, label]) => {
    const d = weekly[key];
    if (!d || !d.isOpen) return `${label}: Closed`;
    const brk = d.breakStart && d.breakEnd ? ` (break ${to12Hour(d.breakStart)}–${to12Hour(d.breakEnd)})` : '';
    return `${label}: ${to12Hour(d.openTime)} – ${to12Hour(d.closeTime)}${brk}`;
  });
  return lines.join('\n');
}

/**
 * Build a compact availability block for the AI context: working hours plus the
 * next available slots so the assistant can offer real times, never invented ones.
 */
export async function buildAppointmentAvailabilityContext(
  businessId: string,
  now: Date = new Date()
): Promise<string> {
  try {
    const [summary, upcoming] = await Promise.all([
      getWorkingHoursSummary(businessId),
      getUpcomingAvailability(businessId, 7, now),
    ]);
    const settings = await ensureAppointmentSettings(businessId);

    const openDays = upcoming.filter((d) => d.isOpen && d.slots.length > 0).slice(0, 5);
    const availabilityLines = openDays.map((d) => {
      const times = d.slots.slice(0, 8).map((s) => s.label).join(', ');
      return `${d.date} (${capitalize(d.weekday)}): ${times}`;
    });

    const closures = upcoming
      .filter((d) => !d.isOpen && d.reason)
      .slice(0, 5)
      .map((d) => `${d.date}: Closed — ${d.reason}`);

    const sections = [
      'WORKING HOURS (timezone ' + settings.timezone + '):',
      summary,
      '',
      'NEXT AVAILABLE APPOINTMENT SLOTS:',
      availabilityLines.length ? availabilityLines.join('\n') : 'No open slots in the next 7 days.',
    ];
    if (closures.length) {
      sections.push('', 'UPCOMING CLOSURES / EXCEPTIONS:', closures.join('\n'));
    }
    sections.push(
      '',
      'Only offer times listed above. Never invent appointment times. If none fit, ask the customer for a preferred day and check availability.'
    );
    return sections.join('\n');
  } catch (error) {
    logger.warn('Failed to build appointment availability context', {
      businessId,
      error: error instanceof Error ? error.message : String(error),
    });
    return '';
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
