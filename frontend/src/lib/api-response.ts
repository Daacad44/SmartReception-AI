import type { ApiResponse } from './types';

export function readSuccessBody(body: ApiResponse | undefined | null): ApiResponse {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid response');
  }
  if (!body.success) {
    throw new Error(body.error || body.message || 'Request failed');
  }
  return body;
}

export function readApiData<T>(body: ApiResponse<T> | undefined | null): T {
  const successBody = readSuccessBody(body);
  if (successBody.data === undefined) {
    throw new Error('No data in response');
  }
  return successBody.data as T;
}
