import { Bell, BellOff, CheckCircle2, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePwaInstall } from './PwaInstallProvider';
import { usePushNotifications } from './usePushNotifications';
import { InstallButton } from './InstallButton';

/** Settings surface for installing the app and managing push notifications. */
export function PwaSettingsCard() {
  const { isInstalled } = usePwaInstall();
  const push = usePushNotifications();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Application</CardTitle>
        <CardDescription>
          Install SmartReception as a native app and control device notifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Smartphone className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Install the app</p>
              <p className="text-xs text-muted-foreground">
                Launch from your home screen or dock with offline access.
              </p>
            </div>
          </div>
          {isInstalled ? (
            <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              Installed
            </span>
          ) : (
            <InstallButton hideWhenUnavailable={false} />
          )}
        </div>

        {push.available && (
          <div className="flex items-center justify-between gap-4 border-t pt-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                {push.subscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </span>
              <div>
                <p className="text-sm font-medium">Push notifications</p>
                <p className="text-xs text-muted-foreground">
                  New messages, appointments and handoff alerts on this device.
                </p>
              </div>
            </div>
            {push.subscribed ? (
              <Button
                variant="outline"
                size="sm"
                disabled={push.busy}
                onClick={() => push.unsubscribe()}
              >
                Disable
              </Button>
            ) : (
              <Button
                variant="accent"
                size="sm"
                disabled={push.busy || push.permission === 'denied'}
                onClick={() => push.subscribe()}
              >
                {push.permission === 'denied' ? 'Blocked' : 'Enable'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
