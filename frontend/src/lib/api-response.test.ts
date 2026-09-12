import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readApiData, readSuccessBody } from './api-response';

describe('readSuccessBody', () => {
  it('accepts forgot-password style success with message only', () => {
    const body = readSuccessBody({
      success: true,
      message: 'If the email exists, a reset code has been sent',
    });
    assert.equal(body.success, true);
  });

  it('rejects unsuccessful responses', () => {
    assert.throws(
      () => readSuccessBody({ success: false, error: 'Nope' }),
      /Nope/
    );
  });
});

describe('readApiData', () => {
  it('throws No data in response when data is missing', () => {
    assert.throws(
      () => readApiData({ success: true, message: 'ok' }),
      /No data in response/
    );
  });

  it('returns data when present', () => {
    assert.deepEqual(readApiData({ success: true, data: { message: 'ok' } }), { message: 'ok' });
  });
});
