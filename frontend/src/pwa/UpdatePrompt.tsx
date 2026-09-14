import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from './useOnlineStatus';

// Re-check for a new deployment every hour while the app stays open.
const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60;

/**
 * Surfaces an offline indicator. Service-worker updates apply automatically
 * (`registerType: 'autoUpdate'` + skipWaiting): installed PWAs pick up a
 * new deploy on the next launch without a manual "Update" tap.
 */
export function UpdatePrompt() {
  const online = useOnlineStatus();

  const { offlineReady: [offlineReady, setOfflineReady] } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      window.setInterval(() => {
        if (navigator.onLine) registration.update().catch(() => undefined);
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast.success('SomReception AI is ready to work offline.', { duration: 4000 });
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  if (online) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/15 px-3.5 py-1.5 text-xs font-medium text-amber-200 shadow-lg backdrop-blur">
        <WifiOff className="h-3.5 w-3.5" />
        You are offline — showing your last synced data.
      </div>
    </div>
  );
}
