import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractWebhookMetadata } from '../../modules/whatsapp/whatsapp-tenant-resolver.service';

test('extractWebhookMetadata reads phone_number_id and display_phone_number', () => {
  const metadata = extractWebhookMetadata({
    metadata: {
      phone_number_id: '1196526726869654',
      display_phone_number: '+252687716299',
    },
    messages: [],
  });

  assert.equal(metadata.phone_number_id, '1196526726869654');
  assert.equal(metadata.display_phone_number, '+252687716299');
});

test('extractWebhookMetadata returns empty object when metadata missing', () => {
  const metadata = extractWebhookMetadata({ messages: [] });
  assert.equal(metadata.phone_number_id, undefined);
  assert.equal(metadata.display_phone_number, undefined);
});
