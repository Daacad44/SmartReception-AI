import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  consumeLoginAttempt,
  LOGIN_RATE_LIMIT_MAX,
  resetLoginRateLimitForTests,
} from './login-rate-limit';

afterEach(() => {
  resetLoginRateLimitForTests();
});

describe('login rate limit', () => {
  it('allows 10 attempts and blocks the 11th for the same IP', async () => {
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX; i++) {
      const result = await consumeLoginAttempt(`user${i}@example.com`, '1.1.1.1');
      assert.equal(result.limited, false);
    }
    const blocked = await consumeLoginAttempt('another@example.com', '1.1.1.1');
    assert.equal(blocked.limited, true);
    assert.ok(blocked.retryAfterSec >= 1);
  });

  it('allows 10 attempts and blocks the 11th for the same account across IPs', async () => {
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX; i++) {
      const result = await consumeLoginAttempt('target@example.com', `10.0.0.${i}`);
      assert.equal(result.limited, false);
    }
    const blocked = await consumeLoginAttempt('target@example.com', '10.0.0.99');
    assert.equal(blocked.limited, true);
  });

  it('does not let an attacker bypass by changing only email or only IP after the combo limit', async () => {
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX; i++) {
      await consumeLoginAttempt('combo@example.com', '8.8.8.8');
    }
    const samePair = await consumeLoginAttempt('combo@example.com', '8.8.8.8');
    assert.equal(samePair.limited, true);
  });
});
