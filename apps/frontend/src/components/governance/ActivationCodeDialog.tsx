import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import type { GovernanceApprovalRequest } from '@/lib/governance';
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

interface ActivationCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: GovernanceApprovalRequest | null;
  onActivated?: () => void;
}

export function ActivationCodeDialog({
  open,
  onOpenChange,
  request,
  onActivated,
}: ActivationCodeDialogProps) {
  const [code, setCode] = useState('');
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  const activate = useMutation({
    mutationFn: async () => {
      if (!request) throw new Error('No request selected');
      const response = await api.post(`/governance/requests/${request.id}/activate`, {
        code: code.trim(),
      });
      return extractData(response);
    },
    onSuccess: () => {
      setSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['ai-training'] });
      queryClient.invalidateQueries({ queryKey: ['governance'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      queryClient.invalidateQueries({ queryKey: ['business-profile'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      toast.success('Action completed successfully');
      onActivated?.();
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
    if (!activate.isPending) {
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
            Enter Activation Code
          </DialogTitle>
          <DialogDescription>
            Your administrator approved{' '}
            <strong>{request?.actionLabel ?? 'this action'}</strong>. Enter the 6-digit code from
            your email to complete it.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {success ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 animate-in zoom-in duration-300" />
              <p className="text-lg font-semibold">Verified</p>
              <p className="text-sm text-muted-foreground">Your change is now live.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Label htmlFor="activation-code">6-digit code</Label>
              <Input
                id="activation-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                autoComplete="one-time-code"
              />
              {request?.activationCodeExpiresAt && (
                <p className="text-xs text-muted-foreground text-center">
                  Expires {new Date(request.activationCodeExpiresAt).toLocaleTimeString()}
                </p>
              )}
            </div>
          )}
        </DialogBody>
        {!success && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)} disabled={activate.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => activate.mutate()}
              disabled={code.length !== 6 || activate.isPending}
            >
              {activate.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                'Verify & Execute'
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
