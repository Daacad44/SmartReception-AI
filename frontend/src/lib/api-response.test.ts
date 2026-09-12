import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { unwrapApiResponse } from './api-response.ts';

describe('unwrapApiResponse', () => {
  it('returns data when the envelope includes it', () => {
    const result = unwrapApiResponse<{ id: string }>({
      success: true,
      data: { id: 'user-1' },
    });
    assert.deepEqual(result, { id: 'user-1' });
  });

  it('accepts message-only success used by forgot/reset password', () => {
    const result = unwrapApiResponse<{ message: string }>({
      success: true,
      message: 'If the email exists, a reset code has been sent',
    });
    assert.deepEqual(result, {
      message: 'If the email exists, a reset code has been sent',
    });
  });

  it('prefers data over a sibling message field', () => {
    const result = unwrapApiResponse<{ message: string }>({
      success: true,
      message: 'ignored',
      data: { message: 'from data' },
    });
    assert.deepEqual(result, { message: 'from data' });
  });

  it('throws the envelope error when success is false', () => {
    assert.throws(
      () =>
        unwrapApiResponse({
          success: false,
          error: 'Invalid or expired reset code',
        }),
      /Invalid or expired reset code/
    );
  });

  it('throws No data in response when success has neither data nor message', () => {
    assert.throws(
      () => unwrapApiResponse({ success: true }),
      /No data in response/
    );
  });
});
