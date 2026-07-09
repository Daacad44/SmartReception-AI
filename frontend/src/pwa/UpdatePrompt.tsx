import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/Logo';
import { useOnlineStatus } from './useOnlineStatus';

// Re-check for a new deployment every hour while the app stays open.
const UPDATE_CHECK_INTERVAL_MS = 1000 * 60 * 60;

/**
 * Surfaces two things:
 *  1. "A new version is available" → reload without losing work.
 *  2. An offline indicator pill when connectivity drops.
 */
export function UpdatePrompt() {
  const online = useOnlineStatus();

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      window.setInterval(() => {
        if (navigator.onLine) registration.update().catch(() => undefined);
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast.success('SmartReception is ready to work offline.', { duration: 4000 });
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  return (
    <>
      {!online && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex justify-center px-3">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/15 px-3.5 py-1.5 text-xs font-medium text-amber-200 shadow-lg backdrop-blur">
            <WifiOff className="h-3.5 w-3.5" />
            You are offline — showing your last synced data.
          </div>
        </div>
      )}

      {needRefresh && (
        <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-500 sm:inset-x-auto sm:right-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-navy p-3 pr-3 text-white shadow-2xl">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#090B14]">
              <LogoMark size={26} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Update available</p>
              <p className="truncate text-xs text-white/60">
                A new version of SmartReception AI is ready.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setNeedRefresh(false)}
            >
              Later
            </Button>
            <Button
              variant="accent"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => updateServiceWorker(true)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Update
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
