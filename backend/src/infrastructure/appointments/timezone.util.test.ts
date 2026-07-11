import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  zonedWallTimeToUtc,
  formatDateInTz,
  formatTimeInTz,
  weekdayKeyForDate,
  timeToMinutes,
  minutesToTime,
  to12Hour,
} from './timezone.util';

test('zonedWallTimeToUtc maps Mogadishu wall time (UTC+3) to correct UTC', () => {
  // 09:00 in Africa/Mogadishu is 06:00 UTC.
  const utc = zonedWallTimeToUtc(2026, 7, 11, 9, 0, 'Africa/Mogadishu');
  assert.equal(utc.toISOString(), '2026-07-11T06:00:00.000Z');
});

test('round-trips a wall time back through the timezone formatters', () => {
  const utc = zonedWallTimeToUtc(2026, 7, 11, 14, 30, 'Africa/Mogadishu');
  assert.equal(formatDateInTz(utc, 'Africa/Mogadishu'), '2026-07-11');
  assert.equal(formatTimeInTz(utc, 'Africa/Mogadishu'), '14:30');
});

test('handles a DST timezone correctly (America/New_York in July = UTC-4)', () => {
  const utc = zonedWallTimeToUtc(2026, 7, 11, 9, 0, 'America/New_York');
  assert.equal(utc.toISOString(), '2026-07-11T13:00:00.000Z');
});

test('weekdayKeyForDate returns the ISO weekday name', () => {
  assert.equal(weekdayKeyForDate('2026-07-11'), 'saturday');
  assert.equal(weekdayKeyForDate('2026-07-13'), 'monday');
});

test('time helpers convert between formats', () => {
  assert.equal(timeToMinutes('09:30'), 570);
  assert.equal(minutesToTime(570), '09:30');
  assert.equal(to12Hour('14:30'), '2:30 PM');
  assert.equal(to12Hour('09:00'), '9:00 AM');
  assert.equal(to12Hour('00:00'), '12:00 AM');
});
