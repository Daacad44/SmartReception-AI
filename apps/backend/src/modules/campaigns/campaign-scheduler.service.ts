import type { CampaignSchedule } from '@prisma/client';

export type ScheduleConfig = {
  weekdays?: number[];
  dayOfMonth?: number;
  lastDayOfMonth?: boolean;
  yearlyMonth?: number;
  yearlyDay?: number;
  hour?: number;
  minute?: number;
};

function withTime(base: Date, hour = 8, minute = 0): Date {
  const next = new Date(base);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function nextWeekday(from: Date, weekdays: number[], hour = 8, minute = 0): Date {
  const sorted = [...weekdays].sort((a, b) => a - b);
  const candidate = new Date(from);
  for (let i = 0; i < 14; i++) {
    const day = candidate.getDay();
    if (sorted.includes(day)) {
      const at = withTime(candidate, hour, minute);
      if (at.getTime() > from.getTime()) return at;
    }
    candidate.setDate(candidate.getDate() + 1);
  }
  return withTime(new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000), hour, minute);
}

function nextMonthDay(from: Date, dayOfMonth: number, lastDay = false, hour = 8, minute = 0): Date {
  const next = new Date(from);
  next.setMonth(next.getMonth() + 1);
  if (lastDay) {
    next.setMonth(next.getMonth() + 1, 0);
  } else {
    const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(dayOfMonth, daysInMonth));
  }
  return withTime(next, hour, minute);
}

function nextYearly(from: Date, month: number, day: number, hour = 8, minute = 0): Date {
  const next = new Date(from);
  next.setFullYear(next.getFullYear() + 1, month - 1, day);
  return withTime(next, hour, minute);
}

/** Compute the next run time for a campaign schedule (timezone stored on campaign/business). */
export function computeNextCampaignRun(params: {
  schedule: CampaignSchedule;
  from: Date;
  scheduleConfig?: ScheduleConfig | null;
  cronExpression?: string | null;
}): Date | null {
  const { schedule, from, scheduleConfig, cronExpression } = params;
  const hour = scheduleConfig?.hour ?? 8;
  const minute = scheduleConfig?.minute ?? 0;

  switch (schedule) {
    case 'DAILY': {
      const next = withTime(new Date(from), hour, minute);
      if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
      return next;
    }
    case 'WEEKLY': {
      const weekdays = scheduleConfig?.weekdays?.length ? scheduleConfig.weekdays : [from.getDay()];
      return nextWeekday(from, weekdays, hour, minute);
    }
    case 'MONTHLY': {
      if (scheduleConfig?.lastDayOfMonth) {
        return nextMonthDay(from, 1, true, hour, minute);
      }
      return nextMonthDay(from, scheduleConfig?.dayOfMonth ?? from.getDate(), false, hour, minute);
    }
    case 'YEARLY': {
      const month = scheduleConfig?.yearlyMonth ?? from.getMonth() + 1;
      const day = scheduleConfig?.yearlyDay ?? from.getDate();
      return nextYearly(from, month, day, hour, minute);
    }
    case 'RECURRING':
    case 'CUSTOM': {
      if (cronExpression?.trim()) {
        return computeSimpleCronNext(cronExpression, from);
      }
      const next = withTime(new Date(from), hour, minute);
      if (next.getTime() <= from.getTime()) next.setDate(next.getDate() + 1);
      return next;
    }
    default:
      return null;
  }
}

/** Minimal cron support: "m h * * d" (minute hour day-of-week). */
function computeSimpleCronNext(expression: string, from: Date): Date | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return null;
  const minute = parts[0] === '*' ? 0 : Number(parts[0]);
  const hour = parts[1] === '*' ? 8 : Number(parts[1]);
  const dowPart = parts[4];
  const weekdays =
    dowPart === '*'
      ? [0, 1, 2, 3, 4, 5, 6]
      : dowPart.split(',').map((d) => Number(d));

  if (weekdays.some((d) => Number.isNaN(d))) return null;
  return nextWeekday(from, weekdays, hour, minute);
}

export function shouldStopRecurring(params: {
  runsCompleted: number;
  repeatCount?: number | null;
  repeatUntil?: Date | null;
}): boolean {
  if (params.repeatCount != null && params.runsCompleted >= params.repeatCount) return true;
  if (params.repeatUntil && new Date() >= params.repeatUntil) return true;
  return false;
}
