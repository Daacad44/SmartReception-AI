import { useRealtime } from '@/hooks/useRealtime';
import { useAuthStore } from '@/stores/auth.store';

/** Subscribes to business-wide realtime events for the authenticated session. */
export function GlobalRealtime() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  useRealtime({ userId });
  return null;
}
