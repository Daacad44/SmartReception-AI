import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { Download, Loader2, WifiOff } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/Logo';
import { useOnlineStatus } from './useOnlineStatus';
import { attachServiceWorkerUpdateChecks, UPDATE_PROMPT_COPY } from './sw-update-check';

/**
 * When a new deploy is waiting, the service worker stays idle until the user
 * taps Aqbal. Updates never apply in the background.
 */
export function UpdatePrompt() {
  const online = useOnlineStatus();
  const [snoozed, setSnoozed] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      attachServiceWorkerUpdateChecks(registration);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast.success('SomReception AI is ready to work offline.', { duration: 4000 });
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (!needRefresh) setSnoozed(false);
  }, [needRefresh]);

  const acceptUpdate = () => {
    setAccepting(true);
    void updateServiceWorker(true);
  };

  return (
    <>
      <Dialog
        open={needRefresh && !snoozed}
        onOpenChange={(open) => {
          if (!open && needRefresh) setSnoozed(true);
        }}
      >
        <DialogContent
          className="max-w-md overflow-hidden p-0 [&>button.absolute]:hidden"
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <div className="bg-navy px-6 pb-6 pt-7 text-white">
            <div className="flex items-center gap-4">
              <BrandLogo variant="icon" decorative className="h-14 w-14 shrink-0" />
              <DialogHeader className="space-y-1 border-0 p-0 text-left">
                <DialogTitle className="text-lg font-bold text-white">
                  {UPDATE_PROMPT_COPY.title}
                </DialogTitle>
                <DialogDescription className="text-sm text-white/70">
                  {UPDATE_PROMPT_COPY.body}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
          <div className="flex gap-3 px-6 py-5">
            <Button variant="ghost" className="flex-1" onClick={() => setSnoozed(true)}>
              {UPDATE_PROMPT_COPY.later}
            </Button>
            <Button
              variant="accent"
              className="flex-1"
              onClick={acceptUpdate}
              disabled={accepting}
            >
              {accepting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {UPDATE_PROMPT_COPY.accept}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {needRefresh && snoozed && (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[70] flex justify-center px-3">
          <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-accent/30 bg-navy px-3.5 py-2 text-white shadow-2xl">
            <p className="min-w-0 flex-1 text-sm font-medium">{UPDATE_PROMPT_COPY.bannerHint}</p>
            <Button variant="accent" size="sm" onClick={acceptUpdate} disabled={accepting}>
              {UPDATE_PROMPT_COPY.accept}
            </Button>
          </div>
        </div>
      )}

      {!online && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex justify-center px-3">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/15 px-3.5 py-1.5 text-xs font-medium text-amber-200 shadow-lg backdrop-blur">
            <WifiOff className="h-3.5 w-3.5" />
            You are offline — showing your last synced data.
          </div>
        </div>
      )}
    </>
  );
}
