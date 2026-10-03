export type RetriableRequest = {
  url?: string;
  retryAttempted?: boolean;
};

const NON_REFRESHABLE_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/verify-2fa',
  '/auth/verify-otp',
  '/auth/verify-approval',
  '/auth/forgot-password',
  '/auth/reset-password',
];

export function shouldRefreshAfterUnauthorized(request: RetriableRequest): boolean {
  if (request.retryAttempted) return false;
  return !NON_REFRESHABLE_AUTH_PATHS.some((path) => request.url?.includes(path));
}

/** Coalesce concurrent expired-token responses into exactly one refresh call. */
export function createSingleFlight<T>() {
  let inFlight: Promise<T> | null = null;
  return (operation: () => Promise<T>): Promise<T> => {
    if (inFlight) return inFlight;
    inFlight = operation().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
