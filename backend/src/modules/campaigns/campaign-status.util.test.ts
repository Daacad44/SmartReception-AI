import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextCampaignStatusAfterWebhook } from './campaign-status.util';

test('COMPLETED campaign with 0 sent and 1 failed becomes FAILED after webhook', () => {
  assert.equal(
    nextCampaignStatusAfterWebhook({
      currentStatus: 'COMPLETED',
      pendingCount: 0,
      sentCount: 0,
      failedCount: 1,
    }),
    'FAILED'
  );
});

test('does not change status while recipients are still pending', () => {
  assert.equal(
    nextCampaignStatusAfterWebhook({
      currentStatus: 'COMPLETED',
      pendingCount: 1,
      sentCount: 0,
      failedCount: 1,
    }),
    null
  );
});

test('mixed success stays COMPLETED', () => {
  assert.equal(
    nextCampaignStatusAfterWebhook({
      currentStatus: 'COMPLETED',
      pendingCount: 0,
      sentCount: 2,
      failedCount: 1,
    }),
    null
  );
});

test('CANCELLED campaigns are left unchanged', () => {
  assert.equal(
    nextCampaignStatusAfterWebhook({
      currentStatus: 'CANCELLED',
      pendingCount: 0,
      sentCount: 0,
      failedCount: 1,
    }),
    null
  );
});

test('already FAILED does not emit another status write', () => {
  assert.equal(
    nextCampaignStatusAfterWebhook({
      currentStatus: 'FAILED',
      pendingCount: 0,
      sentCount: 0,
      failedCount: 1,
    }),
    null
  );
});
