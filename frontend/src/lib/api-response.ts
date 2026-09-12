import type { ApiResponse } from './types';

/**
 * Unwrap a standard API envelope.
 *
 * Some auth endpoints (forgot/reset password, logout) return
 * `{ success: true, message }` with no `data` field. Treat that as
 * `{ message }` so callers using extractData do not throw after a
 * successful side-effect such as sending the reset email.
 */
export function unwrapApiResponse<T>(body: ApiResponse<T> | undefined | null): T {
  if (!body || typeof body !== 'object') {
    throw new Error('No data in response');
  }
  if (!body.success) {
    throw new Error(body.error || body.message || 'Request failed');
  }
  if (body.data !== undefined) {
    return body.data;
  }
  if (typeof body.message === 'string') {
    return { message: body.message } as T;
  }
  throw new Error('No data in response');
}
