import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWebhookBody } from '../../infrastructure/whatsapp/whatsapp-webhook.parser';
import { canApplyCampaignWebhookStatus, deliveryFailureMetadata } from '../campaigns/campaign-webhook-sync.service';
import { formatLifecycleMessage, webhookEventId } from './whatsapp-observability';

test('failed status preserves all optional Meta error fields', () => {
  const parsed = parseWebhookBody({
    entry: [{ changes: [{ value: { metadata: { phone_number_id: 'phone-1' }, statuses: [{
      id: 'wamid.failure', status: 'failed', timestamp: '1791067860', recipient_id: '252611111111',
      errors: [{ code: 131047, title: 'Re-engagement message', message: 'Meta message',
        href: 'https://developers.facebook.com/docs/whatsapp', error_data: { details: 'Meta details' } }],
    }] } }] }],
  });
  const at = new Date('2026-10-03T20:11:00.000Z');
  assert.deepEqual(deliveryFailureMetadata(parsed.statuses[0].errors, at), {
    failedReason: 'Meta message', failureCode: '131047', failureTitle: 'Re-engagement message',
    failureMessage: 'Meta message', failureDetails: 'Meta details',
    failureHref: 'https://developers.facebook.com/docs/whatsapp', failedAt: at,
  });
});

test('failed status without optional error fields uses safe persistence fallbacks', () => {
  const at = new Date('2026-10-03T20:11:00.000Z');
  assert.deepEqual(deliveryFailureMetadata(undefined, at), {
    failedReason: 'Delivery failed', failureCode: null, failureTitle: null,
    failureMessage: null, failureDetails: null, failureHref: null, failedAt: at,
  });
});

test('failure log is multiline and uses N/A for missing optional Meta fields', () => {
  assert.equal(formatLifecycleMessage('WhatsApp', 'Delivery FAILED', {
    messageId: 'wamid.failure', code: undefined, details: null,
  }), '[WhatsApp] Delivery FAILED\nmessageId: wamid.failure\ncode: N/A\ndetails: N/A');
});

test('status event ids deduplicate the same state but allow lifecycle progression', () => {
  assert.equal(webhookEventId('status', 'wamid.1', 'delivered'), 'status:wamid.1:delivered');
  assert.equal(webhookEventId('status', 'wamid.1', 'delivered'), webhookEventId('status', 'wamid.1', 'DELIVERED'));
  assert.notEqual(webhookEventId('status', 'wamid.1', 'sent'), webhookEventId('status', 'wamid.1', 'delivered'));
});

test('delivery status precedence prevents duplicate and out-of-order downgrades', () => {
  assert.equal(canApplyCampaignWebhookStatus('SENT', 'delivered'), true);
  assert.equal(canApplyCampaignWebhookStatus('DELIVERED', 'delivered'), false);
  assert.equal(canApplyCampaignWebhookStatus('READ', 'delivered'), false);
  assert.equal(canApplyCampaignWebhookStatus('READ', 'sent'), false);
  assert.equal(canApplyCampaignWebhookStatus('DELIVERED', 'failed'), false);
  assert.equal(canApplyCampaignWebhookStatus('SENT', 'failed'), true);
});
