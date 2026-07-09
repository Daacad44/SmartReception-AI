import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/Logo';
import { usePwaInstall } from './PwaInstallProvider';
import { InstallDialog } from './InstallDialog';
import { isInstallBannerSnoozed, snoozeInstallBanner } from './install-preferences';

/**
 * Auto-appearing install banner. Slides up a few seconds after load when the
 * app is installable and the user hasn't recently dismissed it. Uses the shared
 * premium dialog for the actual install flow (and iOS instructions).
 */
export function InstallBanner() {
  const { isInstallable } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!isInstallable || isInstallBannerSnoozed()) return;
    const timer = window.setTimeout(() => setVisible(true), 3500);
    return () => window.clearTimeout(timer);
  }, [isInstallable]);

  const dismiss = () => {
    snoozeInstallBanner();
    setVisible(false);
  };

  if (!isInstallable || !visible) {
    return (
      <InstallDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onResolved={(o) => o === 'dismissed' && snoozeInstallBanner()}
      />
    );
  }

  return (
    <>
      <div
        role="dialog"
        aria-label="Install SmartReception AI"
        className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-500 sm:inset-x-auto sm:right-4"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-navy p-3 pr-2 text-white shadow-2xl">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#090B14]">
            <LogoMark size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Install SmartReception AI</p>
            <p className="truncate text-xs text-white/60">
              Faster access, offline mode & notifications.
            </p>
          </div>
          <Button
            variant="accent"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setDialogOpen(true);
              setVisible(false);
            }}
          >
            Install
          </Button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="shrink-0 rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <InstallDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onResolved={(o) => o === 'dismissed' && snoozeInstallBanner()}
      />
    </>
  );
}
