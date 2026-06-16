import { useAuthStore } from '@/stores/auth.store';

/**
 * True only after persisted auth state has rehydrated, session bootstrap finished,
 * and a bearer token is available. Prevents 401 storms on page load.
 */
export function useAuthReady(): boolean {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const sessionReady = useAuthStore((s) => s.sessionReady);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  return hasHydrated && sessionReady && isAuthenticated && Boolean(accessToken);
}
