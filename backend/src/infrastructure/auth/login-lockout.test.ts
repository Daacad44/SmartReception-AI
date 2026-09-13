import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertLoginAllowed,
  recordFailedLogin,
  clearLoginAttempts,
} from './login-lockout.service';
import { TooManyRequestsError } from '../../core/errors';

describe('login lockout', () => {
  it('allows 10 failed attempts then rate-limits until the window expires', async () => {
    const email = `lockout-${Date.now()}@example.com`;
    const ip = '198.51.100.20';
    await clearLoginAttempts(email, ip);

    for (let i = 0; i < 9; i++) {
      await recordFailedLogin(email, ip);
      await assertLoginAllowed(email, ip);
    }

    await recordFailedLogin(email, ip);
    await assert.rejects(() => assertLoginAllowed(email, ip), (err: unknown) => {
      assert.ok(err instanceof TooManyRequestsError);
      assert.equal(err.statusCode, 429);
      assert.equal(err.code, 'RATE_LIMITED');
      return true;
    });

    await clearLoginAttempts(email, ip);
    await assertLoginAllowed(email, ip);
  });
});
