import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WHATSAPP_SESSION_MS,
  buildWhatsAppSessionWindow,
  resolveInboundTimestamp,
} from './whatsapp-session.service';
import { phonesMatchDigitized } from '../../core/utils/customer-phone';

describe('resolveInboundTimestamp', () => {
  it('uses Meta whatsappTimestamp seconds from metadata', () => {
    const at = resolveInboundTimestamp({ whatsappTimestamp: '1710000000' });
    assert.equal(at.getTime(), 1710000000 * 1000);
  });

  it('falls back to createdAt when metadata is missing', () => {
    const createdAt = new Date('2025-01-01T12:00:00.000Z');
    const at = resolveInboundTimestamp(undefined, createdAt);
    assert.equal(at.toISOString(), createdAt.toISOString());
  });
});

describe('buildWhatsAppSessionWindow', () => {
  it('marks session open within 24 hours of last inbound', () => {
    const recent = new Date(Date.now() - 60 * 60 * 1000);
    const window = buildWhatsAppSessionWindow(recent);
    assert.equal(window.isOpen, true);
    assert.ok(window.remainingMs > 0);
    assert.ok(window.remainingMs <= WHATSAPP_SESSION_MS);
  });

  it('marks session closed after 24 hours', () => {
    const old = new Date(Date.now() - WHATSAPP_SESSION_MS - 1000);
    const window = buildWhatsAppSessionWindow(old);
    assert.equal(window.isOpen, false);
    assert.equal(window.remainingMs, 0);
  });

  it('returns closed when no inbound exists', () => {
    const window = buildWhatsAppSessionWindow(null);
    assert.equal(window.isOpen, false);
    assert.equal(window.lastInboundAt, null);
  });
});

describe('phonesMatchDigitized', () => {
  it('matches exact digit strings', () => {
    assert.equal(phonesMatchDigitized('252618912807', '252618912807'), true);
  });

  it('matches local vs international Somalia formats', () => {
    assert.equal(phonesMatchDigitized('618912807', '252618912807'), true);
    assert.equal(phonesMatchDigitized('252618912807', '618912807'), true);
  });

  it('does not match unrelated numbers', () => {
    assert.equal(phonesMatchDigitized('252611111111', '252622222222'), false);
  });
});
