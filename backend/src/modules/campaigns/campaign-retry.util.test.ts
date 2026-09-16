import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCampaignRetryBlockReason,
  isPartialCampaignRetry,
  isPermanentCampaignFailure,
  isRetryableFailedRecipient,
  MAX_CAMPAIGN_RETRIES,
} from './campaign-retry.util';
import { resolveCampaignSessionSend } from './campaign-session-send';

test('131026 / opted out / blocked / invalid are permanent failures', () => {
  assert.equal(isPermanentCampaignFailure('Graph error 131026: recipient cannot be messaged'), true);
  assert.equal(isPermanentCampaignFailure('Customer opted out'), true);
  assert.equal(isPermanentCampaignFailure('Number is blocked'), true);
  assert.equal(isPermanentCampaignFailure('Invalid phone number'), true);
});

test('131047 session errors are retryable, not permanent', () => {
  assert.equal(isPermanentCampaignFailure('(#131047) Re-engagement message'), false);
  assert.equal(isPermanentCampaignFailure('Message failed to send because more than 24 hours have passed (131047)'), false);
  assert.equal(isPermanentCampaignFailure('Re-engagement message'), false);
});

test('isRetryableFailedRecipient skips opt-out, empty phone, and permanent fails', () => {
  assert.equal(
    isRetryableFailedRecipient({
      status: 'FAILED',
      phone: '252611111111',
      failedReason: '131047 session expired',
      optedOut: false,
    }),
    true
  );
  assert.equal(
    isRetryableFailedRecipient({
      status: 'SENT',
      phone: '252611111111',
      failedReason: null,
      optedOut: false,
    }),
    false
  );
  assert.equal(
    isRetryableFailedRecipient({
      status: 'FAILED',
      phone: '252611111111',
      failedReason: '131047',
      optedOut: true,
    }),
    false
  );
  assert.equal(
    isRetryableFailedRecipient({
      status: 'FAILED',
      phone: '',
      failedReason: 'Send failed',
      optedOut: false,
    }),
    false
  );
  assert.equal(
    isRetryableFailedRecipient({
      status: 'FAILED',
      phone: '252611111111',
      failedReason: '131026',
      optedOut: false,
    }),
    false
  );
});

test('retry is blocked while sending and after max retries or cooldown', () => {
  assert.match(getCampaignRetryBlockReason({ status: 'RUNNING', retryCount: 0, lastRetryAt: null }) ?? '', /running/i);
  assert.match(getCampaignRetryBlockReason({ status: 'SENDING', retryCount: 0, lastRetryAt: null }) ?? '', /sending/i);
  assert.match(
    getCampaignRetryBlockReason({ status: 'FAILED', retryCount: MAX_CAMPAIGN_RETRIES, lastRetryAt: null }) ?? '',
    /maximum/i
  );
  assert.match(
    getCampaignRetryBlockReason({
      status: 'FAILED',
      retryCount: 1,
      lastRetryAt: new Date(),
      now: new Date(),
    }) ?? '',
    /wait/i
  );
  assert.equal(
    getCampaignRetryBlockReason({
      status: 'FAILED',
      retryCount: 1,
      lastRetryAt: new Date(Date.now() - 6 * 60 * 1000),
      now: new Date(),
    }),
    null
  );
});

test('partial retry is detected when some recipients keep an older runVersion', () => {
  assert.equal(isPartialCampaignRetry(1, [0, 1, 1]), true);
  assert.equal(isPartialCampaignRetry(0, [0, 0]), false);
});

test('closed session TEXT send uses Meta template; missing template skips', () => {
  const customer = {
    name: 'Ahmed',
    phone: '252611111111',
    email: null,
    companyName: null,
    city: null,
    country: null,
  };

  const withTemplate = resolveCampaignSessionSend({
    messageType: 'TEXT',
    sessionOpen: false,
    template: {
      name: 'Summer Promo',
      content: 'Hi {{customer_name}}',
      variables: ['customer_name'],
      whatsappTemplateName: 'summer_promo',
      whatsappTemplateLanguage: 'en',
    },
    reengagement: { name: null, language: 'en', hasBodyVariable: false },
    personalization: { businessName: 'Botan', customer },
  });
  assert.equal(withTemplate.type, 'TEMPLATE');
  assert.equal(withTemplate.templateName, 'summer_promo');
  assert.equal(withTemplate.skipReason, undefined);

  const missing = resolveCampaignSessionSend({
    messageType: 'TEXT',
    sessionOpen: false,
    template: null,
    reengagement: { name: null, language: 'en', hasBodyVariable: false },
    personalization: { businessName: 'Botan', customer },
  });
  assert.ok(missing.skipReason);
  assert.match(missing.skipReason ?? '', /24-hour session/);

  const openSession = resolveCampaignSessionSend({
    messageType: 'TEXT',
    sessionOpen: true,
    template: null,
    reengagement: null,
    personalization: { businessName: 'Botan', customer },
  });
  assert.equal(openSession.type, 'TEXT');
  assert.equal(openSession.skipReason, undefined);

  const media = resolveCampaignSessionSend({
    messageType: 'IMAGE',
    sessionOpen: false,
    template: null,
    reengagement: null,
    personalization: { businessName: 'Botan', customer },
  });
  assert.equal(media.type, 'IMAGE');
});
