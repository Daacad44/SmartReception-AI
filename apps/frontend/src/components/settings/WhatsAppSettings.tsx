import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWhatsAppAccounts, useWhatsAppWebhookInfo } from '@/hooks/useApi';
import { useConnectWhatsApp, useDisconnectWhatsApp } from '@/hooks/useMutations';
import { LoadingState } from '@/components/LoadingState';
import { Copy, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function WhatsAppSettings() {
  const { data: accounts, isLoading } = useWhatsAppAccounts();
  const { data: webhookInfo } = useWhatsAppWebhookInfo();
  const connectWhatsApp = useConnectWhatsApp();
  const disconnectWhatsApp = useDisconnectWhatsApp();

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
          <CardDescription>
            Use these values in your Meta WhatsApp App webhook settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {webhookInfo && (
            <>
              <div className="space-y-2">
                <Label>Callback URL</Label>
                <div className="flex gap-2">
                  <Input readOnly value={webhookInfo.webhookUrl} />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(webhookInfo.webhookUrl)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Verify Token</Label>
                <div className="flex gap-2">
                  <Input readOnly value={webhookInfo.verifyToken} />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(webhookInfo.verifyToken)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
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
          <CardTitle>Connect WhatsApp Business Account</CardTitle>
          <CardDescription>
            Enter credentials from Meta Business Suite / WhatsApp Cloud API
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
