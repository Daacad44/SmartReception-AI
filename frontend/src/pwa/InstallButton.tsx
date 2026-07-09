import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePwaInstall } from './PwaInstallProvider';
import { InstallDialog } from './InstallDialog';
import { snoozeInstallBanner } from './install-preferences';

interface InstallButtonProps extends Omit<ButtonProps, 'onClick'> {
  label?: string;
  /** When true, keep occupying layout space by rendering nothing if not installable. */
  hideWhenUnavailable?: boolean;
}

/**
 * Reusable "Install App" button. Renders only when the app can actually be
 * installed (native prompt available, or iOS Safari), and never once installed.
 * Drop it into the login page, landing page, dashboard header, settings, etc.
 */
export function InstallButton({
  label = 'Install App',
  variant = 'outline',
  size = 'sm',
  className,
  hideWhenUnavailable = true,
  ...props
}: InstallButtonProps) {
  const { isInstallable, isInstalled } = usePwaInstall();
  const [open, setOpen] = useState(false);

  if (isInstalled || (!isInstallable && hideWhenUnavailable)) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn('gap-2', className)}
        onClick={() => setOpen(true)}
        {...props}
      >
        <Download className="h-4 w-4" />
        {label}
      </Button>
      <InstallDialog
        open={open}
        onOpenChange={setOpen}
        onResolved={(outcome) => {
          if (outcome === 'dismissed') snoozeInstallBanner();
        }}
      />
    </>
  );
}
