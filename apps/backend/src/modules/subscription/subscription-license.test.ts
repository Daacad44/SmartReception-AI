import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRemainingTime,
  isLicenseStatusLocked,
} from './subscription-license.service';
import { LOCKED_LICENSE_STATUSES } from './subscription.types';

test('isLicenseStatusLocked covers enterprise statuses', () => {
  for (const status of LOCKED_LICENSE_STATUSES) {
    assert.equal(isLicenseStatusLocked(status), true);
  }
  assert.equal(isLicenseStatusLocked('ACTIVE'), false);
  assert.equal(isLicenseStatusLocked('TRIAL'), false);
});

test('formatRemainingTime handles future and past expiration', () => {
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  assert.match(formatRemainingTime(future), /3 days/);
  const past = new Date(Date.now() - 1000);
  assert.equal(formatRemainingTime(past), 'Expired');
});
