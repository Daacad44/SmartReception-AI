import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, QrCode, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api, { extractData } from '@/lib/api';
import { toast } from 'sonner';

interface TwoFactorStatus {
  enabled: boolean;
  isSuperAdmin: boolean;
}

interface SetupResponse {
  qrCode: string;
  backupCodes: string[];
}

export function TwoFactorSettings() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [setupData, setSetupData] = useState<SetupResponse | null>(null);
  const [disablePassword, setDisablePassword] = useState('');

  const { data: status } = useQuery({
    queryKey: ['2fa', 'status'],
    queryFn: async () => {
      const res = await api.get('/2fa/status');
      return extractData<TwoFactorStatus>(res);
    },
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/2fa/setup');
      return extractData<SetupResponse>(res);
    },
    onSuccess: (data) => {
      setSetupData(data);
      toast.success('Scan the QR code with Google Authenticator');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      await api.post('/2fa/confirm', { code });
    },
    onSuccess: () => {
      toast.success('Two-factor authentication enabled');
      setSetupData(null);
      setCode('');
      queryClient.invalidateQueries({ queryKey: ['2fa'] });
    },
    onError: () => toast.error('Invalid code. Please try again.'),
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      await api.post('/2fa/disable', { password: disablePassword, code });
    },
    onSuccess: () => {
      toast.success('Two-factor authentication disabled');
      setCode('');
      setDisablePassword('');
      queryClient.invalidateQueries({ queryKey: ['2fa'] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-5 w-5 text-accent" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Required for Super Admin, Owner, and Admin roles. Use Google Authenticator.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <BadgeStatus enabled={status?.enabled ?? false} />
          {status?.isSuperAdmin && (
            <span className="text-xs text-muted-foreground">Super Admin account</span>
          )}
        </div>

        {!status?.enabled && !setupData && (
          <Button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>
            <QrCode className="mr-2 h-4 w-4" />
            Set up 2FA
          </Button>
        )}

        {setupData && (
          <div className="space-y-4 rounded-lg border p-4">
            <img src={setupData.qrCode} alt="2FA QR Code" className="mx-auto h-48 w-48" />
            <div>
              <p className="text-sm font-medium mb-2">Backup codes (save these securely):</p>
              <div className="grid grid-cols-2 gap-1 font-mono text-xs">
                {setupData.backupCodes.map((c) => (
                  <span key={c} className="rounded bg-muted px-2 py-1">{c}</span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Enter code from app</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" maxLength={6} />
              <Button onClick={() => confirmMutation.mutate()} disabled={code.length !== 6}>
                Confirm & Enable
              </Button>
            </div>
          </div>
        )}

        {status?.enabled && (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">To disable 2FA, enter your password and current code.</p>
            <Input type="password" placeholder="Password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} />
            <Input placeholder="Authenticator code" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button variant="destructive" onClick={() => disableMutation.mutate()} disabled={!code || !disablePassword}>
              <KeyRound className="mr-2 h-4 w-4" />
              Disable 2FA
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BadgeStatus({ enabled }: { enabled: boolean }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${enabled ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
      {enabled ? 'Enabled' : 'Not enabled'}
    </span>
  );
}
