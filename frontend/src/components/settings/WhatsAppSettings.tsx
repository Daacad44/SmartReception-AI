import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { extractData, getErrorMessage } from '@/lib/api';
import type { GovernanceCapabilities, WhatsAppConnectionWindow } from '@/lib/governance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  useWhatsAppAccounts,
  useWhatsAppWebhookInfo,
  useWhatsAppHealth,
  useWhatsAppWebhookHealth,
  useWhatsAppDebug,
  useWhatsAppStatus,
  useWhatsAppOAuthConfig,
} from '@/hooks/useApi';
import {
  useConnectWhatsApp,
  useConnectWhatsAppOAuth,
  useConnectWhatsAppFromEnv,
  useDisconnectWhatsApp,
  useTestWhatsAppConnection,
  useUpdateWhatsAppAccount,
} from '@/hooks/useMutations';
import { useFacebookEmbeddedSignup } from '@/hooks/useFacebookEmbeddedSignup';
import { LoadingState } from '@/components/LoadingState';
import { Copy, Trash2, Plug, Wifi, RefreshCw, Lock, Link2, Clock, Send, XCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/utils';

function statusBadgeVariant(
  status: string
): 'success' | 'warning' | 'secondary' | 'destructive' {
  const normalized = status.toLowerCase();
  if (['connected', 'verified', 'active'].includes(normalized)) return 'success';
  if (['pending', 'receiving'].includes(normalized)) return 'warning';
  if (['disconnected', 'inactive', 'not_configured'].includes(normalized)) return 'destructive';
  return 'secondary';
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

function formatWindowRemaining(expiresAt: string | null): string {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

export function WhatsAppSettings() {
  const queryClient = useQueryClient();
  const [debugEnabled, setDebugEnabled] = useState(false);
  const { data: governanceCaps } = useQuery({
    queryKey: ['governance', 'capabilities'],
    queryFn: async () => {
      const response = await api.get('/governance/capabilities');
      return extractData<GovernanceCapabilities>(response);
    },
    // Poll while a connection request is in flight so the tab flips to the full
    // UI the moment the Super Admin approves, and reflects EXPIRED when it lapses.
    refetchInterval: (query) => {
      const status = (query.state.data as GovernanceCapabilities | undefined)
        ?.whatsappConnectionWindow?.status;
      return status === 'PENDING' || status === 'APPROVED' ? 15_000 : false;
    },
  });
  const whatsappManaged = governanceCaps?.whatsappAccess === 'hidden';
  const connectionWindow = governanceCaps?.whatsappConnectionWindow ?? null;

  const submitConnectionRequest = useMutation({
    mutationFn: async () => {
      const response = await api.post('/whatsapp/connection-request');
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['governance', 'capabilities'] });
      toast.success('Request submitted — your Super Administrator will review it.');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const { data: accounts, isLoading: accountsLoading, refetch: refetchAccounts } =
    useWhatsAppAccounts();
  const { data: webhookInfo } = useWhatsAppWebhookInfo();
  const {
    data: webhookHealth,
    refetch: refetchWebhookHealth,
  } = useWhatsAppWebhookHealth();
  const {
    data: health,
    isLoading: healthLoading,
  } = useWhatsAppHealth();
  const { data: debugInfo, refetch: refetchDebug } = useWhatsAppDebug(debugEnabled);
  const { data: connectionStatus, refetch: refetchStatus } = useWhatsAppStatus();
  const connectWhatsApp = useConnectWhatsApp();
  const connectWhatsAppOAuth = useConnectWhatsAppOAuth();
  const connectFromEnv = useConnectWhatsAppFromEnv();
  const disconnectWhatsApp = useDisconnectWhatsApp();
  const { data: oauthConfig } = useWhatsAppOAuthConfig();
  const { sdkReady, launchSignup } = useFacebookEmbeddedSignup(
    oauthConfig?.appId,
    oauthConfig?.apiVersion || 'v23.0'
  );

  const handleConnectWithFacebook = async () => {
    if (!oauthConfig?.configId) return;
    try {
      const { code, wabaId, phoneNumberId } = await launchSignup(oauthConfig.configId);
      await connectWhatsAppOAuth.mutateAsync({ code, wabaId, phoneNumberId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Facebook connect failed');
    }
  };
  const testConnection = useTestWhatsAppConnection();
  const updateWhatsAppAccount = useUpdateWhatsAppAccount();

  const [reengagementForm, setReengagementForm] = useState({
    reengagementTemplateName: '',
    reengagementTemplateLanguage: 'en',
    reengagementTemplateHasBodyVariable: false,
  });

  const [form, setForm] = useState({
    phoneNumberId: '',
    phoneNumber: '',
    displayName: '',
    wabaId: '',
    accessToken: '',
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    await connectWhatsApp.mutateAsync(form);
    setForm({ phoneNumberId: '', phoneNumber: '', displayName: '', wabaId: '', accessToken: '' });
  };

  const handleRefresh = async () => {
    setDebugEnabled(true);
    refetchAccounts();
    refetchWebhookHealth();
    refetchStatus();
    await queryClient.fetchQuery({
      queryKey: ['whatsapp-health', true],
      queryFn: async () => {
        const response = await api.get('/whatsapp/health', { params: { live: '1' } });
        return extractData(response);
      },
    });
    queryClient.invalidateQueries({ queryKey: ['whatsapp-health', false] });
    void refetchDebug();
  };

  const workspaceStatus = connectionStatus?.whatsappStatus ?? 'NOT_CONNECTED';

  const webhookIsVerified =
    webhookHealth?.verified === true ||
    webhookHealth?.receivingEvents === true ||
    webhookHealth?.status === 'verified';
  const webhookDisplayStatus = webhookIsVerified ? 'verified' : webhookHealth?.status ?? 'not_configured';

  const activeAccount = accounts?.find((a) => a.isActive);

  useEffect(() => {
    if (activeAccount) {
      setReengagementForm({
        reengagementTemplateName: activeAccount.reengagementTemplateName ?? '',
        reengagementTemplateLanguage: activeAccount.reengagementTemplateLanguage ?? 'en',
        reengagementTemplateHasBodyVariable:
          activeAccount.reengagementTemplateHasBodyVariable ?? false,
      });
    }
  }, [
    activeAccount?.id,
    activeAccount?.reengagementTemplateName,
    activeAccount?.reengagementTemplateLanguage,
    activeAccount?.reengagementTemplateHasBodyVariable,
  ]);

  if (accountsLoading || healthLoading) {
    return <LoadingState rows={4} />;
  }

  if (whatsappManaged) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            WhatsApp Managed by Administrator
          </CardTitle>
          <CardDescription>
            On your {governanceCaps?.planCode ?? 'current'} plan, WhatsApp integration is configured
            by your Super Administrator. You can request a time-limited window to connect your own
            WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Badge variant={workspaceStatus === 'CONNECTED' ? 'success' : 'secondary'}>
              {workspaceStatus === 'CONNECTED' ? 'Connected' : 'Not Connected'}
            </Badge>
            {activeAccount && (
              <p className="mt-3 text-sm text-muted-foreground">
                Number: {activeAccount.phoneNumber} · {activeAccount.displayName}
              </p>
            )}
          </div>

          {workspaceStatus !== 'CONNECTED' && (
            <ConnectionRequestPanel
              window={connectionWindow}
              submitting={submitConnectionRequest.isPending}
              onRequest={() => submitConnectionRequest.mutate()}
            />
          )}
        </CardContent>
      </Card>
    );
  }

  const handleSaveReengagementTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) return;
    await updateWhatsAppAccount.mutateAsync({
      accountId: activeAccount.id,
      data: {
        reengagementTemplateName: reengagementForm.reengagementTemplateName.trim() || null,
        reengagementTemplateLanguage: reengagementForm.reengagementTemplateLanguage.trim() || 'en',
        reengagementTemplateHasBodyVariable: reengagementForm.reengagementTemplateHasBodyVariable,
      },
    });
  };

  return (
    <div className="space-y-6">
      {connectionWindow?.windowOpen && workspaceStatus !== 'CONNECTED' && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
          <Clock className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Connection window open · {formatWindowRemaining(connectionWindow.windowExpiresAt)}</p>
            <p className="mt-0.5 text-amber-800/90 dark:text-amber-200/80">
              Connect your WhatsApp before the window closes. Once connected it stays connected —
              the window expiry will not disconnect you.
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">WhatsApp Integration</h2>
          <p className="text-sm text-muted-foreground">
            Connect, update, test, or disconnect your Meta WhatsApp Cloud API credentials.
          </p>
        </div>
        <Badge
          variant={workspaceStatus === 'CONNECTED' ? 'success' : 'destructive'}
          className="capitalize"
        >
          {workspaceStatus === 'CONNECTED' ? 'Connected' : 'Not Connected'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
          <CardDescription>Live WhatsApp Cloud API health from Meta and webhooks</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Connection</p>
            <Badge
              variant={statusBadgeVariant(health?.connection ?? 'disconnected')}
              className="mt-1 capitalize"
            >
              {formatStatusLabel(health?.connection ?? 'disconnected')}
            </Badge>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Webhook</p>
            <Badge
              variant={statusBadgeVariant(webhookDisplayStatus)}
              className="mt-1 capitalize"
            >
              {formatStatusLabel(webhookDisplayStatus)}
            </Badge>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Phone Status</p>
            <Badge
              variant={statusBadgeVariant(health?.phoneStatus ?? 'unknown')}
              className="mt-1 capitalize"
            >
              {formatStatusLabel(health?.phoneStatus ?? 'unknown')}
            </Badge>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Last Sync</p>
            <p className="mt-1 text-sm font-medium">
              {health?.lastSync ? formatRelativeTime(health.lastSync) : 'Never'}
            </p>
          </div>
        </CardContent>
        <CardContent className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Business Name</p>
            <p className="text-sm font-medium">{health?.businessName ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Connected Phone Number</p>
            <p className="font-mono text-sm">{health?.phoneNumber ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Phone Number ID</p>
            <p className="font-mono text-sm break-all">{health?.phoneNumberId ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">WABA ID</p>
            <p className="font-mono text-sm break-all">{health?.wabaId ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Token Status</p>
            <Badge variant={statusBadgeVariant(health?.tokenStatus ?? 'not_configured')} className="capitalize">
              {formatStatusLabel(health?.tokenStatus ?? 'not_configured')}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Last Webhook Event</p>
            <p className="text-sm">
              {health?.lastWebhookReceived ? formatRelativeTime(health.lastWebhookReceived) : 'Never'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Last Message Received</p>
            <p className="text-sm truncate" title={health?.lastIncomingMessage ?? undefined}>
              {health?.lastIncomingMessage ?? '—'}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Last Message Sent</p>
            <p className="text-sm truncate" title={health?.lastOutgoingMessage ?? undefined}>
              {health?.lastOutgoingMessage ?? '—'}
            </p>
          </div>
        </CardContent>
        <CardContent className="flex flex-wrap gap-2 pt-0">
          {health?.envConfigured && (
            <Button
              variant="outline"
              onClick={() => connectFromEnv.mutate()}
              disabled={connectFromEnv.isPending}
            >
              <Plug className="mr-2 h-4 w-4" />
              Connect from Environment
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => testConnection.mutate(activeAccount?.id)}
            disabled={!activeAccount || testConnection.isPending}
          >
            <Wifi className="mr-2 h-4 w-4" />
            Test Connection
          </Button>
          <Button variant="ghost" onClick={handleRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {debugInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Diagnostics</CardTitle>
            <CardDescription>Live pipeline status for troubleshooting</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <span className="text-muted-foreground">AI Status: </span>
              <Badge variant={statusBadgeVariant(debugInfo.ai_status)} className="capitalize">
                {debugInfo.ai_status}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Graph API Error: </span>
              <span className="font-mono text-xs">{debugInfo.last_graph_api_error ?? 'None'}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Last Incoming: </span>
              <span>{debugInfo.last_incoming_message ?? '—'}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-muted-foreground">Last Outgoing: </span>
              <span>{debugInfo.last_outgoing_message ?? '—'}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
          <CardDescription>
            Configure these in Meta Developer Console → WhatsApp → Configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {webhookInfo && (
            <>
              <div className="space-y-2">
                <Label>Callback URL (production)</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={webhookInfo.webhookUrl}
                    className="font-mono text-xs sm:text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => copyToClipboard(webhookInfo.webhookUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use this exact URL in Meta Developer Console → WhatsApp → Configuration
                </p>
              </div>
              <div className="space-y-2">
                <Label>Verify Token</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={webhookInfo.verifyToken || 'Not configured'}
                    className="font-mono text-xs sm:text-sm"
                  />
                  {webhookInfo.verifyToken && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => copyToClipboard(webhookInfo.verifyToken)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Enter this same value as the Verify Token in Meta webhook settings
                </p>
              </div>
              {webhookInfo.legacyWebhookUrl && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Legacy callback URL</Label>
                  <Input
                    readOnly
                    value={webhookInfo.legacyWebhookUrl}
                    className="font-mono text-xs text-muted-foreground"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {activeAccount && (
        <Card>
          <CardHeader>
            <CardTitle>Re-engagement Template</CardTitle>
            <CardDescription>
              Meta-approved template for messages outside the 24-hour session. Use the exact name from
              WhatsApp Manager (e.g. <code className="text-xs">smartreception_welcome</code>).
              Fixed templates without {'{{1}}'} should leave the body-variable option unchecked.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveReengagementTemplate} className="grid max-w-lg gap-4">
              <div className="space-y-2">
                <Label>Template Name (Meta)</Label>
                <Input
                  value={reengagementForm.reengagementTemplateName}
                  onChange={(e) =>
                    setReengagementForm({ ...reengagementForm, reengagementTemplateName: e.target.value })
                  }
                  placeholder="smartreception_welcome"
                />
              </div>
              <div className="space-y-2">
                <Label>Template Language</Label>
                <Input
                  value={reengagementForm.reengagementTemplateLanguage}
                  onChange={(e) =>
                    setReengagementForm({
                      ...reengagementForm,
                      reengagementTemplateLanguage: e.target.value,
                    })
                  }
                  placeholder="en"
                />
                <p className="text-xs text-muted-foreground">
                  Use Meta language code only: <code>en</code> or <code>en_US</code> — not &quot;English&quot;.
                </p>
              </div>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={reengagementForm.reengagementTemplateHasBodyVariable}
                  onChange={(e) =>
                    setReengagementForm({
                      ...reengagementForm,
                      reengagementTemplateHasBodyVariable: e.target.checked,
                    })
                  }
                />
                <span className="text-sm leading-snug">
                  Meta template has a body variable {'{{1}}'} (custom message text). Leave unchecked
                  for fixed templates like smartreception_welcome.
                </span>
              </label>
              <Button type="submit" disabled={updateWhatsAppAccount.isPending}>
                Save Template Settings
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!accounts?.length ? (
            <p className="text-sm text-muted-foreground">No WhatsApp accounts connected yet.</p>
          ) : (
            accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{account.displayName || account.phoneNumber}</p>
                  <p className="text-sm text-muted-foreground">
                    {account.phoneNumber} · ID: {account.phoneNumberId}
                  </p>
                  {account.wabaId && (
                    <p className="text-xs text-muted-foreground">WABA: {account.wabaId}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={account.isActive ? 'success' : 'secondary'}>
                    {account.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => disconnectWhatsApp.mutate(account.id)}
                    disabled={disconnectWhatsApp.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connect with Facebook</CardTitle>
          <CardDescription>
            Recommended: connect through Meta&apos;s official WhatsApp Embedded Signup flow — no
            manual copy-pasting of tokens or IDs required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {oauthConfig?.configured ? (
            <Button
              type="button"
              onClick={handleConnectWithFacebook}
              disabled={!sdkReady || connectWhatsAppOAuth.isPending}
            >
              <Link2 className="mr-2 h-4 w-4" />
              {connectWhatsAppOAuth.isPending ? 'Connecting…' : 'Connect with Facebook'}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Facebook connect isn&apos;t configured on this server yet. An administrator needs to
              set <code className="text-xs">META_APP_ID</code>,{' '}
              <code className="text-xs">META_APP_SECRET</code>, and{' '}
              <code className="text-xs">META_WHATSAPP_CONFIG_ID</code> from Meta Developer Console
              (App → WhatsApp → Embedded Signup). Until then, use manual connection below.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connect Manually</CardTitle>
          <CardDescription>
            Enter your Meta Cloud API credentials. Tokens are encrypted and stored per workspace.
            Use this as an advanced/fallback option if Facebook connect above isn&apos;t available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnect} className="space-y-4 max-w-lg">
            <div className="space-y-2">
              <Label>Phone Number ID</Label>
              <Input
                value={form.phoneNumberId}
                onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
                placeholder="From Meta Developer Console"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                placeholder="+1234567890"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Display Name (optional)</Label>
              <Input
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>WABA ID (optional)</Label>
              <Input
                value={form.wabaId}
                onChange={(e) => setForm({ ...form, wabaId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Permanent Access Token</Label>
              <Input
                type="password"
                value={form.accessToken}
                onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                required
              />
            </div>
            <Button type="submit" disabled={connectWhatsApp.isPending}>
              Connect Account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionRequestPanel({
  window,
  submitting,
  onRequest,
}: {
  window: WhatsAppConnectionWindow | null;
  submitting: boolean;
  onRequest: () => void;
}) {
  const status = window?.status;

  // PENDING — awaiting Super Admin review.
  if (status === 'PENDING') {
    return (
      <div className="rounded-lg border bg-muted/40 p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-medium">Request pending</p>
          <Badge variant="warning">PENDING</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Your request to connect WhatsApp is waiting for Super Administrator approval. You&apos;ll be
          notified by email and in-app once it&apos;s reviewed.
        </p>
      </div>
    );
  }

  // REJECTED — show reason, allow re-request.
  if (status === 'REJECTED') {
    return (
      <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-destructive" />
          <p className="text-sm font-medium">Request rejected</p>
          <Badge variant="destructive">REJECTED</Badge>
        </div>
        {window?.rejectionReason && (
          <p className="text-sm text-muted-foreground">Reason: {window.rejectionReason}</p>
        )}
        <Button onClick={onRequest} disabled={submitting}>
          <Send className="mr-2 h-4 w-4" />
          {submitting ? 'Submitting…' : 'Request Again'}
        </Button>
      </div>
    );
  }

  // EXPIRED — window lapsed without connecting; allow re-request.
  if (status === 'EXPIRED') {
    return (
      <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Connection window expired</p>
          <Badge variant="secondary">EXPIRED</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          The approved window closed before WhatsApp was connected. Submit a new request to get
          another window.
        </p>
        <Button onClick={onRequest} disabled={submitting}>
          <Send className="mr-2 h-4 w-4" />
          {submitting ? 'Submitting…' : 'Request Again'}
        </Button>
      </div>
    );
  }

  // CONNECTED — terminal (typically the full UI renders instead; shown for safety).
  if (status === 'CONNECTED') {
    return (
      <div className="rounded-lg border bg-muted/40 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-medium">WhatsApp connected</p>
          <Badge variant="success">CONNECTED</Badge>
        </div>
      </div>
    );
  }

  // No request yet (or APPROVED-but-open which renders the full UI elsewhere).
  return (
    <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
      <p className="text-sm text-muted-foreground">
        Request a connection window from your Super Administrator. When approved, you&apos;ll get a
        time-limited window to connect your own WhatsApp. Once connected, it stays connected.
      </p>
      <Button onClick={onRequest} disabled={submitting}>
        <Send className="mr-2 h-4 w-4" />
        {submitting ? 'Submitting…' : 'Request Connection Access'}
      </Button>
    </div>
  );
}
