import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api, { extractData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export interface AssignSubscriptionDetail {
  business: {
    id: string;
    name: string;
    email: string | null;
    licenseStatus: string;
    owner: { name: string; email: string } | null;
    subscription: {
      plan: { code: string; name: string };
      status: string;
      expiresAt: string | null;
    } | null;
  };
}

interface PlanOption {
  id: string;
  code: string;
  name: string;
  monthlyPrice: number;
}

const DURATIONS = [
  { value: 'DAYS_7', label: '7 Days' },
  { value: 'DAYS_14', label: '14 Days' },
  { value: 'DAYS_30', label: '30 Days' },
  { value: 'DAYS_60', label: '60 Days' },
  { value: 'DAYS_90', label: '90 Days' },
  { value: 'DAYS_180', label: '180 Days' },
  { value: 'DAYS_365', label: '365 Days' },
  { value: 'CUSTOM', label: 'Custom' },
] as const;

const PAYMENT_STATUSES = [
  'PAID',
  'PENDING',
  'MANUAL',
  'COMPLIMENTARY',
  'LOCAL_PAYMENT_PENDING',
] as const;

const PAYMENT_METHODS = [
  'CASH',
  'EVC_PLUS',
  'ZAAD',
  'EDAHAB',
  'PREMIER_WALLET',
  'BANK',
  'MANUAL',
] as const;

interface AssignSubscriptionModalProps {
  businessId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AssignSubscriptionModal({
  businessId,
  open,
  onOpenChange,
  onSuccess,
}: AssignSubscriptionModalProps) {
  const [form, setForm] = useState({
    planCode: 'STARTER',
    durationPreset: 'DAYS_30',
    customDurationDays: '30',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    isTrial: false,
    paymentStatus: 'PENDING',
    paymentMethod: 'MANUAL',
    referenceNumber: '',
    invoiceNumber: '',
    amount: '',
    internalNotes: '',
    reason: '',
  });

  const { data: detail } = useQuery({
    queryKey: ['super-admin', 'subscription-detail', businessId],
    enabled: open && Boolean(businessId),
    queryFn: async () => {
      const res = await api.get(`/super-admin/subscriptions/${businessId}`);
      return res.data.data as AssignSubscriptionDetail;
    },
  });

  const { data: plans } = useQuery({
    queryKey: ['super-admin', 'subscription-plans'],
    enabled: open,
    queryFn: async () => {
      const res = await api.get('/super-admin/subscriptions/plans');
      return extractData<PlanOption[]>(res);
    },
  });

  const { data: preview } = useQuery({
    queryKey: ['subscription-preview', form],
    enabled: open,
    queryFn: async () => {
      const res = await api.post('/super-admin/subscriptions/calculate-preview', {
        activationDate: form.startDate,
        durationPreset: form.durationPreset,
        customDurationDays:
          form.durationPreset === 'CUSTOM' ? Number(form.customDurationDays) : undefined,
        endDate: form.endDate || undefined,
        isTrial: form.isTrial,
      });
      return res.data.data as {
        startDate: string;
        endDate: string;
        durationDays: number;
        remainingDays: number;
        status: string;
      };
    },
  });

  useEffect(() => {
    if (detail?.business.subscription?.plan.code && open) {
      setForm((f) => ({ ...f, planCode: detail.business.subscription!.plan.code }));
    }
  }, [detail, open]);

  const assignMutation = useMutation({
    mutationFn: async () =>
      api.post(`/super-admin/subscriptions/${businessId}/assign`, {
        planCode: form.planCode,
        durationPreset: form.durationPreset,
        customDurationDays:
          form.durationPreset === 'CUSTOM' ? Number(form.customDurationDays) : undefined,
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        isTrial: form.isTrial,
        paymentStatus: form.paymentStatus,
        paymentMethod: form.paymentMethod,
        referenceNumber: form.referenceNumber || undefined,
        invoiceNumber: form.invoiceNumber || undefined,
        amount: form.amount ? Number(form.amount) : undefined,
        internalNotes: form.internalNotes || undefined,
        reason: form.reason || undefined,
      }),
    onSuccess: () => {
      toast.success('Subscription assigned and activated');
      onSuccess();
      onOpenChange(false);
    },
    onError: () => toast.error('Failed to assign subscription'),
  });

  const business = detail?.business;

  const statusBadge = useMemo(() => business?.licenseStatus ?? 'PENDING', [business]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto border-slate-800 bg-slate-950 text-slate-50">
        <DialogHeader>
          <DialogTitle className="text-xl">Assign Subscription</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="text-sm font-semibold text-amber-400">Business</h3>
            <Field label="Business Name" value={business?.name ?? '—'} readonly />
            <Field label="Business Owner" value={business?.owner?.name ?? '—'} readonly />
            <Field label="Business Email" value={business?.email ?? business?.owner?.email ?? '—'} readonly />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Current Status</span>
              <Badge variant="outline" className="border-amber-500/30 text-amber-300">
                {statusBadge}
              </Badge>
            </div>
            <Field
              label="Current Plan"
              value={business?.subscription?.plan.name ?? 'None'}
              readonly
            />
          </div>

          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="text-sm font-semibold text-amber-400">New Subscription</h3>
            <div>
              <Label className="text-slate-300">New Plan</Label>
              <Select value={form.planCode} onValueChange={(v) => setForm((f) => ({ ...f, planCode: v }))}>
                <SelectTrigger className="border-slate-700 bg-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(plans ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.code}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Duration</Label>
              <Select
                value={form.durationPreset}
                onValueChange={(v) => setForm((f) => ({ ...f, durationPreset: v }))}
              >
                <SelectTrigger className="border-slate-700 bg-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.durationPreset === 'CUSTOM' && (
              <div>
                <Label className="text-slate-300">Custom Days</Label>
                <Input
                  type="number"
                  min={1}
                  className="border-slate-700 bg-slate-900"
                  value={form.customDurationDays}
                  onChange={(e) => setForm((f) => ({ ...f, customDurationDays: e.target.value }))}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300">Start Date</Label>
                <Input
                  type="date"
                  className="border-slate-700 bg-slate-900"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-slate-300">End Date (optional)</Label>
                <Input
                  type="date"
                  className="border-slate-700 bg-slate-900"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-slate-300">Trial</Label>
              <Select
                value={form.isTrial ? 'yes' : 'no'}
                onValueChange={(v) => setForm((f) => ({ ...f, isTrial: v === 'yes' }))}
              >
                <SelectTrigger className="border-slate-700 bg-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="grid gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 md:grid-cols-4">
          <PreviewStat label="Start" value={preview ? new Date(preview.startDate).toLocaleDateString() : '—'} />
          <PreviewStat label="End" value={preview ? new Date(preview.endDate).toLocaleDateString() : '—'} />
          <PreviewStat label="Duration" value={preview ? `${preview.durationDays} days` : '—'} />
          <PreviewStat label="Status" value={preview?.status ?? '—'} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-slate-300">Payment Status</Label>
            <Select
              value={form.paymentStatus}
              onValueChange={(v) => setForm((f) => ({ ...f, paymentStatus: v }))}
            >
              <SelectTrigger className="border-slate-700 bg-slate-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300">Payment Method</Label>
            <Select
              value={form.paymentMethod}
              onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v }))}
            >
              <SelectTrigger className="border-slate-700 bg-slate-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-slate-300">Amount (USD)</Label>
            <Input
              type="number"
              min={0}
              className="border-slate-700 bg-slate-900"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-slate-300">Reference Number</Label>
            <Input
              className="border-slate-700 bg-slate-900"
              value={form.referenceNumber}
              onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))}
            />
          </div>
          <div>
            <Label className="text-slate-300">Invoice Number</Label>
            <Input
              className="border-slate-700 bg-slate-900"
              value={form.invoiceNumber}
              onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <Label className="text-slate-300">Internal Notes</Label>
          <Textarea
            className="border-slate-700 bg-slate-900"
            value={form.internalNotes}
            onChange={(e) => setForm((f) => ({ ...f, internalNotes: e.target.value }))}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-amber-500 text-slate-950 hover:bg-amber-400"
            onClick={() => assignMutation.mutate()}
            disabled={assignMutation.isPending}
          >
            Assign & Activate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, readonly }: { label: string; value: string; readonly?: boolean }) {
  return (
    <div>
      <Label className="text-slate-400">{label}</Label>
      <Input className="border-slate-800 bg-slate-900/80" value={value} readOnly={readonly} />
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold text-amber-300">{value}</p>
    </div>
  );
}
