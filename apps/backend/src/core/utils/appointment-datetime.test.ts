import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAppointmentStart } from './appointment-datetime';

test('parseAppointmentStart parses DD/MM/YYYY with AM/PM in Mogadishu time', () => {
  const now = new Date('2026-06-23T20:00:00.000Z');
  const start = parseAppointmentStart('24/06/2026', '2:30 AM', now);
  assert.equal(start.toISOString(), '2026-06-23T23:30:00.000Z');
});

test('parseAppointmentStart parses 24-hour time', () => {
  const now = new Date('2026-06-23T20:00:00.000Z');
  const start = parseAppointmentStart('24/06/2026', '14:30', now);
  assert.equal(start.toISOString(), '2026-06-24T11:30:00.000Z');
});

test('parseAppointmentStart rejects past dates with fallback', () => {
  const now = new Date('2026-06-25T00:00:00.000Z');
  const start = parseAppointmentStart('24/06/2026', '10:00', now);
  assert.equal(start.toISOString(), '2026-06-26T07:00:00.000Z');
});
