import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api, { extractData } from '@/lib/api';
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
} from '@/hooks/useApi';
import {
  useConnectWhatsApp,
  useConnectWhatsAppFromEnv,
  useDisconnectWhatsApp,
  useTestWhatsAppConnection,
  useUpdateWhatsAppAccount,
} from '@/hooks/useMutations';
import { LoadingState } from '@/components/LoadingState';
import { Copy, Trash2, Plug, Wifi, RefreshCw } from 'lucide-react';
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

export function WhatsAppSettings() {
  const queryClient = useQueryClient();
  const [debugEnabled, setDebugEnabled] = useState(false);
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
  const connectFromEnv = useConnectWhatsAppFromEnv();
  const disconnectWhatsApp = useDisconnectWhatsApp();
  const testConnection = useTestWhatsAppConnection();
  const updateWhatsAppAccount = useUpdateWhatsAppAccount();

  const [reengagementForm, setReengagementForm] = useState({
    reengagementTemplateName: '',
    reengagementTemplateLanguage: 'en',
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
      });
    }
  }, [activeAccount?.id, activeAccount?.reengagementTemplateName, activeAccount?.reengagementTemplateLanguage]);

  if (accountsLoading || healthLoading) {
    return <LoadingState rows={4} />;
  }

  const handleSaveReengagementTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) return;
    await updateWhatsAppAccount.mutateAsync({
      accountId: activeAccount.id,
      data: {
        reengagementTemplateName: reengagementForm.reengagementTemplateName.trim() || null,
        reengagementTemplateLanguage: reengagementForm.reengagementTemplateLanguage.trim() || 'en',
      },
    });
  };

  return (
    <div className="space-y-6">
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
              Meta-approved template name for sending prepared messages outside the 24-hour session.
              Create a template in Meta Business Manager with one body variable (e.g. &quot;Message: {'{{1}}'}&quot;).
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
                  placeholder="e.g. customer_follow_up"
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
              </div>
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
          <CardTitle>Connect Manually</CardTitle>
          <CardDescription>
            Enter your Meta Cloud API credentials. Tokens are encrypted and stored per workspace.
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
