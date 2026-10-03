import assert from 'node:assert/strict';
import test from 'node:test';
import { createSingleFlight, shouldRefreshAfterUnauthorized } from './auth-retry-policy.ts';

test('protected campaign retry is refreshable exactly once', () => {
  assert.equal(shouldRefreshAfterUnauthorized({ url: '/campaigns/c-1/retry-failed' }), true);
  assert.equal(shouldRefreshAfterUnauthorized({ url: '/campaigns/c-1/retry-failed', retryAttempted: true }), false);
  assert.equal(shouldRefreshAfterUnauthorized({ url: '/auth/refresh' }), false);
});

test('concurrent 401 responses share one refresh operation', async () => {
  const singleFlight = createSingleFlight<string>();
  let refreshCalls = 0;
  const refresh = () => singleFlight(async () => {
    refreshCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return 'new-access-token';
  });
  assert.deepEqual(await Promise.all([refresh(), refresh(), refresh()]), [
    'new-access-token', 'new-access-token', 'new-access-token',
  ]);
  assert.equal(refreshCalls, 1);
});

test('failed refresh is cleared and a later session may retry', async () => {
  const singleFlight = createSingleFlight<string>();
  await assert.rejects(singleFlight(async () => { throw new Error('invalid refresh'); }), /invalid refresh/);
  assert.equal(await singleFlight(async () => 're-authenticated'), 're-authenticated');
});
