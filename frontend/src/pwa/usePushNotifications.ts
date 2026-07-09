import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

/**
 * Web Push client. Inert unless a VAPID public key is configured
 * (VITE_VAPID_PUBLIC_KEY), so it never shows broken UI before the backend
 * push pipeline exists. Once the key + backend routes are in place this
 * subscribes the device and registers it server-side.
 *
 * Backend contract (to implement alongside VAPID keys):
 *   POST   /api/v1/notifications/push/subscribe    { subscription }
 *   DELETE /api/v1/notifications/push/subscribe     { endpoint }
 */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

type PushPermission = NotificationPermission | 'unsupported';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function usePushNotifications() {
  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const configured = Boolean(VAPID_PUBLIC_KEY);
  const [permission, setPermission] = useState<PushPermission>(
    supported ? Notification.permission : 'unsupported'
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => undefined);
  }, [supported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported || !configured) return false;
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return false;

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string),
        }));

      await api.post('/notifications/push/subscribe', { subscription });
      setSubscribed(true);
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported, configured]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!supported) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api
          .delete('/notifications/push/subscribe', { data: { endpoint: subscription.endpoint } })
          .catch(() => undefined);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, [supported]);

  return {
    /** Push is available in this browser. */
    supported,
    /** A VAPID key is configured — safe to show enable UI. */
    configured,
    /** Show the enable/disable control only when both are true. */
    available: supported && configured,
    permission,
    subscribed,
    busy,
    subscribe,
    unsubscribe,
  };
}
