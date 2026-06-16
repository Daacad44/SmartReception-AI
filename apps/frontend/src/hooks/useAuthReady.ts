import { useAuthStore } from '@/stores/auth.store';

/**
 * True only after persisted auth state has rehydrated and a bearer token is available.
 */
export function useAuthReady(): boolean {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  return hasHydrated && isAuthenticated && Boolean(accessToken);
}
