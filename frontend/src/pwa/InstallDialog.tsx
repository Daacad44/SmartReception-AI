import { useState } from 'react';
import { Zap, WifiOff, Bell, MonitorSmartphone, Share, SquarePlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/Logo';
import { usePwaInstall } from './PwaInstallProvider';

const FEATURES = [
  { icon: Zap, title: 'Instant access', desc: 'Launch from your home screen or dock — no browser, no tabs.' },
  { icon: WifiOff, title: 'Works offline', desc: 'View cached conversations, dashboard and settings without a connection.' },
  { icon: Bell, title: 'Push notifications', desc: 'New messages, appointments and handoff alerts in real time.' },
  { icon: MonitorSmartphone, title: 'Native experience', desc: 'A fast, full-screen app on desktop and mobile.' },
];

interface InstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the user accepts/declines so callers can persist "maybe later". */
  onResolved?: (outcome: 'accepted' | 'dismissed' | 'unavailable') => void;
}

export function InstallDialog({ open, onOpenChange, onResolved }: InstallDialogProps) {
  const { isIOS, promptInstall } = usePwaInstall();
  const [busy, setBusy] = useState(false);

  const handleInstall = async () => {
    setBusy(true);
    try {
      const outcome = await promptInstall();
      onResolved?.(outcome);
      if (outcome === 'accepted' || outcome === 'unavailable') {
        onOpenChange(false);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLater = () => {
    onResolved?.('dismissed');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div className="bg-navy px-6 pb-6 pt-7 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#090B14] shadow-lg">
              <LogoMark size={34} />
            </div>
            <div className="min-w-0">
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="text-lg font-bold text-white">
                  Install SmartReception AI
                </DialogTitle>
                <DialogDescription className="text-sm text-white/60">
                  Faster access, offline mode, notifications and a native app experience.
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {isIOS ? (
            <IOSInstructions />
          ) : (
            <ul className="space-y-3.5">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={handleLater}>
              Maybe later
            </Button>
            {!isIOS && (
              <Button variant="accent" className="flex-1" onClick={handleInstall} disabled={busy}>
                {busy ? 'Installing…' : 'Install now'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IOSInstructions() {
  const steps = [
    { icon: Share, text: 'Tap the Share button in Safari’s toolbar.' },
    { icon: SquarePlus, text: 'Choose “Add to Home Screen”.' },
    { icon: null, text: 'Tap “Add” — SmartReception installs like a native app.' },
  ];
  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        To install on your iPhone or iPad, add SmartReception to your Home Screen:
      </p>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
              {i + 1}
            </span>
            <span className="flex items-center gap-2 text-sm">
              {step.icon && <step.icon className="h-4 w-4 text-accent" />}
              {step.text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
