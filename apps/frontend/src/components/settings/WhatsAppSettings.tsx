import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWhatsAppAccounts, useWhatsAppWebhookInfo, useWhatsAppStatus } from '@/hooks/useApi';
import {
  useConnectWhatsApp,
  useConnectWhatsAppFromEnv,
  useDisconnectWhatsApp,
  useTestWhatsAppConnection,
} from '@/hooks/useMutations';
import { LoadingState } from '@/components/LoadingState';
import { Copy, Trash2, Plug, Wifi, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/utils';

export function WhatsAppSettings() {
  const { data: accounts, isLoading, refetch } = useWhatsAppAccounts();
  const { data: webhookInfo } = useWhatsAppWebhookInfo();
  const { data: status } = useWhatsAppStatus();
  const connectWhatsApp = useConnectWhatsApp();
  const connectFromEnv = useConnectWhatsAppFromEnv();
  const disconnectWhatsApp = useDisconnectWhatsApp();
  const testConnection = useTestWhatsAppConnection();

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

  if (isLoading) {
    return <LoadingState rows={4} />;
  }

  const activeAccount = accounts?.find((a) => a.isActive);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
          <CardDescription>WhatsApp Cloud API integration status</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Connection</p>
            <Badge variant={status?.connected ? 'success' : 'secondary'} className="mt-1">
              {status?.connected ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Webhook</p>
            <Badge variant={activeAccount?.webhookVerified ? 'success' : 'warning'} className="mt-1">
              {activeAccount?.webhookStatus ?? 'pending'}
            </Badge>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Phone Status</p>
            <p className="mt-1 text-sm font-medium capitalize">
              {activeAccount?.phoneNumberStatus ?? 'unknown'}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">Last Sync</p>
            <p className="mt-1 text-sm font-medium">
              {activeAccount?.lastSyncAt
                ? formatRelativeTime(activeAccount.lastSyncAt)
                : 'Never'}
            </p>
          </div>
        </CardContent>
        <CardContent className="flex flex-wrap gap-2 pt-0">
          {status?.envConfigured && (
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
          <Button variant="ghost" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </CardContent>
      </Card>

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
            Or use &quot;Connect from Environment&quot; if credentials are set in server .env
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
