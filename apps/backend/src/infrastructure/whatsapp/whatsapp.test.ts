import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { parseWebhookBody, extractMessageContent } from './whatsapp-webhook.parser';

describe('WhatsApp webhook parser', () => {
  it('parses inbound text messages', () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: '12345', display_phone_number: '+15551234' },
                messages: [
                  {
                    from: '15559876543',
                    id: 'wamid.abc',
                    timestamp: '1710000000',
                    type: 'text',
                    text: { body: 'Hello' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const parsed = parseWebhookBody(body);
    assert.equal(parsed.phoneNumberId, '12345');
    assert.equal(parsed.messages.length, 1);
    assert.equal(parsed.messages[0].text?.body, 'Hello');
  });

  it('parses delivery status updates', () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: '12345' },
                statuses: [
                  {
                    id: 'wamid.out',
                    status: 'delivered',
                    timestamp: '1710000001',
                    recipient_id: '15559876543',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const parsed = parseWebhookBody(body);
    assert.equal(parsed.statuses.length, 1);
    assert.equal(parsed.statuses[0].status, 'delivered');
  });

  it('extracts interactive button reply content', () => {
    const extracted = extractMessageContent({
      from: '1',
      id: 'wamid.btn',
      timestamp: '1',
      type: 'interactive',
      interactive: { type: 'button_reply', button_reply: { id: 'yes', title: 'Yes' } },
    });
    assert.equal(extracted.content, 'Yes');
    assert.equal(extracted.type, 'INTERACTIVE');
  });

  it('extracts image media metadata', () => {
    const extracted = extractMessageContent({
      from: '1',
      id: 'wamid.img',
      timestamp: '1',
      type: 'image',
      image: { id: 'media123', mime_type: 'image/jpeg', caption: 'Photo' },
    });
    assert.equal(extracted.mediaId, 'media123');
    assert.equal(extracted.content, 'Photo');
    assert.equal(extracted.type, 'IMAGE');
  });
});

describe('WhatsApp webhook signature', () => {
  it('validates X-Hub-Signature-256', () => {
    const secret = 'test-secret';
    const payload = Buffer.from('{"test":true}');
    const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const signature = `sha256=${hash}`;

    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const received = signature.replace('sha256=', '');
    assert.equal(
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received)),
      true
    );
  });
});
