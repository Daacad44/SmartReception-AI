import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  updateBusinessProfileSchema,
  businessExceptionSchema,
  appointmentSettingsSchema,
} from '@smartreception/shared';

// Regression: the frontend seeds its form from the GET response (full row with
// many `null` columns) and PATCHes it back. Previously a single `null` field
// threw a ZodError -> 400 -> "Failed to save Business Profile".
test('updateBusinessProfileSchema accepts null values for every optional field', () => {
  const payload = {
    businessName: 'Acme',
    website: null,
    email: null,
    supportEmail: null,
    logoUrl: null,
    coverImageUrl: null,
    mission: null,
    coreValues: null,
    socialMedia: null,
    yearsInBusiness: null,
    latitude: null,
    longitude: null,
    // Fields not in the schema (id, extractionStatus, …) are stripped, not rejected.
    id: 'abc',
    extractionStatus: 'NONE',
  };
  const parsed = updateBusinessProfileSchema.parse(payload);
  assert.equal(parsed.businessName, 'Acme');
  assert.equal(parsed.website, null);
  assert.equal((parsed as Record<string, unknown>).id, undefined);
});

test('updateBusinessProfileSchema treats empty strings as cleared (null)', () => {
  const parsed = updateBusinessProfileSchema.parse({ mission: '   ', website: '' });
  assert.equal(parsed.mission, null);
  assert.equal(parsed.website, null);
});

test('updateBusinessProfileSchema still rejects a genuinely invalid URL', () => {
  assert.throws(() => updateBusinessProfileSchema.parse({ website: 'not a url' }));
});

test('appointmentSettingsSchema applies sane defaults', () => {
  const parsed = appointmentSettingsSchema.parse({});
  assert.equal(parsed.slotDurationMinutes, 30);
  assert.equal(parsed.minNoticeMinutes, 60);
  assert.equal(parsed.allowSameDay, true);
});

test('businessExceptionSchema requires open/close time when not fully closed', () => {
  assert.throws(() =>
    businessExceptionSchema.parse({
      title: 'Half day',
      type: 'HALF_DAY',
      startDate: '2026-07-11',
      isClosed: false,
    })
  );
  const ok = businessExceptionSchema.parse({
    title: 'Half day',
    type: 'HALF_DAY',
    startDate: '2026-07-11',
    isClosed: false,
    openTime: '09:00',
    closeTime: '13:00',
  });
  assert.equal(ok.openTime, '09:00');
});
