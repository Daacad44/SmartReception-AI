/**
 * Timezone helpers built on the platform Intl API — no external dependency.
 *
 * The appointment engine reasons about wall-clock time in each business's own
 * timezone (e.g. "09:00 in Africa/Mogadishu") but stores/compares instants in
 * UTC. These helpers convert between the two correctly across DST transitions.
 */

const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

interface TzParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number;
  minute: number;
  second: number;
}

/** Offset (minutes) of `tz` from UTC at the given instant. East of UTC is positive. */
function tzOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second')
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** Break an instant into wall-clock parts in the given timezone. */
export function getTzParts(date: Date, tz: string): TzParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * Convert a wall-clock time in `tz` to the corresponding UTC instant.
 * Two-pass fixed-point handles the DST edge where the naive guess lands on the
 * wrong side of a transition.
 */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  let offset = tzOffsetMinutes(new Date(naive), tz);
  let utc = naive - offset * 60000;
  const offset2 = tzOffsetMinutes(new Date(utc), tz);
  if (offset2 !== offset) {
    offset = offset2;
    utc = naive - offset * 60000;
  }
  return new Date(utc);
}

/** 'YYYY-MM-DD' for the instant as seen in `tz`. */
export function formatDateInTz(date: Date, tz: string): string {
  const p = getTzParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** 'HH:MM' (24h) for the instant as seen in `tz`. */
export function formatTimeInTz(date: Date, tz: string): string {
  const p = getTzParts(date, tz);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** Weekday key ('monday'…'sunday') for a 'YYYY-MM-DD' date. */
export function weekdayKeyForDate(dateStr: string): WeekdayKey {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Noon UTC avoids any date rollover from small offsets.
  const idx = new Date(Date.UTC(y!, m! - 1, d!, 12)).getUTCDay();
  return WEEKDAY_KEYS[idx]!;
}

/** Parse 'HH:MM' → minutes since midnight. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** minutes since midnight → 'HH:MM'. */
export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Human 12-hour label for 'HH:MM' (e.g. '14:30' → '2:30 PM'). */
export function to12Hour(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = (h ?? 0) >= 12 ? 'PM' : 'AM';
  let hour = (h ?? 0) % 12;
  if (hour === 0) hour = 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${period}` : `${hour}:00 ${period}`;
}
