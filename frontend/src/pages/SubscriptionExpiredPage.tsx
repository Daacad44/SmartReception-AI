import { AlertTriangle, LogOut, Mail, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSubscriptionLicense } from '@/components/SubscriptionGate';
import { useAuthStore } from '@/stores/auth.store';
import { LoadingState } from '@/components/LoadingState';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function SubscriptionExpiredPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const { data, isLoading } = useSubscriptionLicense();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6">
        <LoadingState rows={4} />
      </div>
    );
  }

  const statusLabel = data?.status?.replace('_', ' ') ?? 'Expired';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6">
      <Card className="w-full max-w-lg border-slate-800 bg-slate-950/80 text-slate-50 shadow-2xl backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
          </div>
          <div className="space-y-2">
            <Badge variant="outline" className="border-amber-500/40 text-amber-300">
              {statusLabel}
            </Badge>
            <CardTitle className="text-2xl">Subscription Expired</CardTitle>
            <CardDescription className="text-slate-400">
              Your subscription has expired. Please contact support or renew your subscription to
              restore full access to SmartReception AI.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm">
            <dl className="space-y-3">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Business</dt>
                <dd className="font-medium">{data?.businessName ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Current Plan</dt>
                <dd className="font-medium">{data?.plan?.name ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Expiration Date</dt>
                <dd className="font-medium">{formatDate(data?.expiresAt ?? null)}</dd>
              </div>
              {(data?.daysExpired ?? 0) > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Days Expired</dt>
                  <dd className="font-medium text-amber-400">{data?.daysExpired}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="flex-1" asChild>
              <a href="mailto:support@botandev.com?subject=SmartReception%20Subscription%20Renewal">
                <Mail className="mr-2 h-4 w-4" />
                Contact Support
              </a>
            </Button>
            <Button variant="secondary" className="flex-1" asChild>
              <a href="mailto:support@botandev.com?subject=Subscription%20Renewal%20Request">
                <RefreshCw className="mr-2 h-4 w-4" />
                Request Renewal
              </a>
            </Button>
          </div>

          <Button
            variant="ghost"
            className="w-full text-slate-400 hover:text-slate-100"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
