/** Somalia (Africa/Mogadishu) is UTC+3 year-round. */
const MOGADISHU_OFFSET_MS = 3 * 60 * 60 * 1000;

function parseTime(timeStr: string): { hour: number; minute: number } {
  const t = timeStr.trim();
  const ampm = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampm) {
    let hour = parseInt(ampm[1]!, 10);
    const minute = parseInt(ampm[2] ?? '0', 10);
    const isPm = ampm[3]!.toUpperCase() === 'PM';
    if (isPm && hour < 12) hour += 12;
    if (!isPm && hour === 12) hour = 0;
    return { hour, minute };
  }

  const h24 = t.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (h24) {
    return { hour: parseInt(h24[1]!, 10), minute: parseInt(h24[2] ?? '0', 10) };
  }

  return { hour: 10, minute: 0 };
}

function defaultFallbackStart(now = new Date()): Date {
  const fallback = new Date(now);
  fallback.setUTCDate(fallback.getUTCDate() + 1);
  fallback.setUTCHours(7, 0, 0, 0);
  return fallback;
}

/** Parse Somali-style DD/MM/YYYY dates and common time formats in Mogadishu local time. */
export function parseAppointmentStart(dateStr: string, timeStr: string, now = new Date()): Date {
  const trimmedDate = dateStr.trim();
  let day: number;
  let month: number;
  let year: number;

  const dmy = trimmedDate.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  const ymd = trimmedDate.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);

  if (dmy) {
    day = parseInt(dmy[1]!, 10);
    month = parseInt(dmy[2]!, 10) - 1;
    year = parseInt(dmy[3]!, 10);
  } else if (ymd) {
    year = parseInt(ymd[1]!, 10);
    month = parseInt(ymd[2]!, 10) - 1;
    day = parseInt(ymd[3]!, 10);
  } else {
    const nativeParsed = new Date(`${trimmedDate} ${timeStr}`.trim());
    if (!isNaN(nativeParsed.getTime()) && nativeParsed > now) {
      return nativeParsed;
    }
    return defaultFallbackStart(now);
  }

  const { hour, minute } = parseTime(timeStr);
  const utcMs = Date.UTC(year, month, day, hour, minute) - MOGADISHU_OFFSET_MS;
  const result = new Date(utcMs);

  if (isNaN(result.getTime()) || result <= now) {
    return defaultFallbackStart(now);
  }

  return result;
}
