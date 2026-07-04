import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const EXTEND_PRESETS = [7, 14, 30, 60, 90, 180, 365];

interface ExtendSubscriptionModalProps {
  businessId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ExtendSubscriptionModal({
  businessId,
  open,
  onOpenChange,
  onSuccess,
}: ExtendSubscriptionModalProps) {
  const [additionalDays, setAdditionalDays] = useState('30');
  const [reason, setReason] = useState('');

  const extendMutation = useMutation({
    mutationFn: async (days: number) =>
      api.post(`/super-admin/subscriptions/${businessId}/extend`, {
        additionalDays: days,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      toast.success('Subscription extended');
      onSuccess();
      onOpenChange(false);
    },
    onError: () => toast.error('Failed to extend subscription'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-800 bg-slate-950 text-slate-50">
        <DialogHeader>
          <DialogTitle>Extend Subscription</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {EXTEND_PRESETS.map((days) => (
            <Button
              key={days}
              size="sm"
              variant="outline"
              className="border-slate-700"
              onClick={() => extendMutation.mutate(days)}
              disabled={extendMutation.isPending}
            >
              +{days} days
            </Button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-slate-300">Custom days</Label>
            <Input
              type="number"
              min={1}
              className="border-slate-700 bg-slate-900"
              value={additionalDays}
              onChange={(e) => setAdditionalDays(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-slate-300">Reason</Label>
            <Input
              className="border-slate-700 bg-slate-900"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-amber-500 text-slate-950 hover:bg-amber-400"
            onClick={() => extendMutation.mutate(Number(additionalDays))}
            disabled={extendMutation.isPending || Number(additionalDays) < 1}
          >
            Extend
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
