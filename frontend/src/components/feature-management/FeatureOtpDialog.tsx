import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import type { FeatureVerificationRequest } from '@/lib/feature-management-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface FeatureOtpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  verification: FeatureVerificationRequest | null;
  onVerified?: () => void;
}

export function FeatureOtpDialog({
  open,
  onOpenChange,
  verification,
  onVerified,
}: FeatureOtpDialogProps) {
  const [code, setCode] = useState('');
  const [success, setSuccess] = useState(false);

  const confirm = useMutation({
    mutationFn: async () => {
      if (!verification) throw new Error('No verification request');
      const response = await api.post('/super-admin/feature-management/verify/confirm', {
        requestId: verification.requestId,
        code: code.trim(),
      });
      return extractData(response);
    },
    onSuccess: () => {
      setSuccess(true);
      toast.success('Feature status updated successfully');
      onVerified?.();
      setTimeout(() => {
        setSuccess(false);
        setCode('');
        onOpenChange(false);
      }, 1800);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleClose = (next: boolean) => {
    if (!confirm.isPending) {
      if (!next) {
        setCode('');
        setSuccess(false);
      }
      onOpenChange(next);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            Verify Feature Change
          </DialogTitle>
          <DialogDescription>
            A 6-digit code was sent to your Super Admin email. Enter it to confirm{' '}
            <strong>{verification?.actionLabel ?? 'this feature change'}</strong> for{' '}
            <strong>{verification?.featureName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {success ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
              <p className="text-lg font-semibold">Verified</p>
              <p className="text-sm text-muted-foreground">Feature status has been updated.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Label htmlFor="feature-otp">6-digit code</Label>
              <Input
                id="feature-otp"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center font-mono text-2xl tracking-[0.5em]"
                autoComplete="one-time-code"
              />
              {verification?.otpExpiresAt && (
                <p className="text-center text-xs text-muted-foreground">
                  Expires {new Date(verification.otpExpiresAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          )}
        </DialogBody>
        {!success && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)} disabled={confirm.isPending}>
              Cancel
            </Button>
            <Button onClick={() => confirm.mutate()} disabled={code.length !== 6 || confirm.isPending}>
              {confirm.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                'Verify & Apply'
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
