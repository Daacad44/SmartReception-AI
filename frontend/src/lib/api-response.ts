import type { ApiResponse } from './types';

export function assertApiSuccess(body: ApiResponse<unknown> | undefined | null): void {
  if (!body?.success) {
    throw new Error(body?.error || body?.message || 'Request failed');
  }
}

export function unwrapApiData<T>(body: ApiResponse<T> | undefined | null): T {
  assertApiSuccess(body);
  if (!body || body.data === undefined) {
    throw new Error('No data in response');
  }
  return body.data;
}
