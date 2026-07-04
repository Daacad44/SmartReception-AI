import { useBusinessRealtime } from '@/hooks/useRealtime';
import { useAuthStore } from '@/stores/auth.store';
import {
  requestDesktopNotificationPermission,
  useHandoffNotificationAlerts,
} from '@/hooks/useHandoffNotificationAlerts';
import { useEffect } from 'react';

/** Subscribes to business-wide realtime events for the authenticated session. */
export function GlobalRealtime() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  useBusinessRealtime(userId);
  useHandoffNotificationAlerts();

  useEffect(() => {
    requestDesktopNotificationPermission();
  }, []);

  return null;
}
