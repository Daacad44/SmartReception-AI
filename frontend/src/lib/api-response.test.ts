import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertApiSuccess, unwrapApiData } from './api-response.ts';

describe('assertApiSuccess', () => {
  it('accepts message-only success payloads used by forgot/reset password', () => {
    assert.doesNotThrow(() =>
      assertApiSuccess({
        success: true,
        message: 'If the email exists, a reset code has been sent',
      })
    );
  });

  it('throws the API error message when success is false', () => {
    assert.throws(
      () => assertApiSuccess({ success: false, error: 'Too many requests' }),
      { message: 'Too many requests' }
    );
  });
});

describe('unwrapApiData', () => {
  it('returns data when present', () => {
    assert.deepEqual(unwrapApiData({ success: true, data: { ok: true } }), { ok: true });
  });

  it('throws No data in response when success has no data field', () => {
    assert.throws(
      () => unwrapApiData({ success: true, message: 'If the email exists, a reset code has been sent' }),
      { message: 'No data in response' }
    );
  });
});
