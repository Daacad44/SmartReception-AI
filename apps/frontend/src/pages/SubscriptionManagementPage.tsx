import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  Search,
  Filter,
  Clock,
  Pause,
  Play,
  Ban,
  Unlock,
  Plus,
  ChevronRight,
} from 'lucide-react';
import api, { extractData } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LoadingState } from '@/components/LoadingState';
import { toast } from 'sonner';

interface SubscriptionRow {
  id: string;
  name: string;
  email: string | null;
  licenseStatus: string;
  isLicenseLocked: boolean;
  subscription: {
    plan: { code: string; name: string };
    expiresAt: string | null;
    status: string;
    paymentStatus: string;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-400',
  TRIAL: 'bg-blue-500/15 text-blue-400',
  EXPIRED: 'bg-red-500/15 text-red-400',
  SUSPENDED: 'bg-amber-500/15 text-amber-400',
  CANCELLED: 'bg-slate-500/15 text-slate-400',
  PENDING: 'bg-purple-500/15 text-purple-400',
};

export function SubscriptionManagementPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    planCode: 'STARTER',
    durationPreset: 'DAYS_30',
    customDurationDays: '',
    internalNotes: '',
  });
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'subscriptions', search, statusFilter],
    queryFn: async () => {
      const res = await api.get('/super-admin/subscriptions', {
        params: {
          limit: 50,
          search: search || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        },
      });
      return res.data as { data: SubscriptionRow[]; meta: { total: number } };
    },
  });

  const { data: plans } = useQuery({
    queryKey: ['super-admin', 'subscription-plans'],
    queryFn: async () => {
      const res = await api.get('/super-admin/subscriptions/plans');
      return extractData<Array<{ id: string; code: string; name: string }>>(res);
    },
  });

  const { data: detail } = useQuery({
    queryKey: ['super-admin', 'subscription-detail', selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const res = await api.get(`/super-admin/subscriptions/${selectedId}`);
      return res.data.data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscriptions'] });
    if (selectedId) {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscription-detail', selectedId] });
    }
  };

  const actionMutation = useMutation({
    mutationFn: async ({ id, action, body }: { id: string; action: string; body?: object }) =>
      api.post(`/super-admin/subscriptions/${id}/${action}`, body ?? {}),
    onSuccess: () => {
      invalidate();
      toast.success('Subscription updated');
    },
    onError: () => toast.error('Action failed'),
  });

  const assignMutation = useMutation({
    mutationFn: async (businessId: string) =>
      api.post(`/super-admin/subscriptions/${businessId}/assign`, {
        planCode: assignForm.planCode,
        durationPreset: assignForm.durationPreset,
        customDurationDays: assignForm.customDurationDays
          ? Number(assignForm.customDurationDays)
          : undefined,
        internalNotes: assignForm.internalNotes || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setAssignOpen(false);
      toast.success('Subscription assigned');
    },
    onError: () => toast.error('Failed to assign subscription'),
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CreditCard className="h-7 w-7 text-primary" />
            Subscription Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Super Admin control over business licenses, expiration, and access.
          </p>
        </div>
        <Badge variant="secondary">{data?.meta?.total ?? 0} businesses</Badge>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">All Businesses</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search businesses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="TRIAL">Trial</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState rows={8} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id)}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.email}</div>
                    </TableCell>
                    <TableCell>{row.subscription?.plan.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[row.licenseStatus] ?? ''}>{row.licenseStatus}</Badge>
                    </TableCell>
                    <TableCell>
                      {row.subscription?.expiresAt
                        ? new Date(row.subscription.expiresAt).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell>{row.subscription?.paymentStatus ?? '—'}</TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedId)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.business?.name ?? 'Subscription Detail'}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-medium">{detail.business.licenseStatus}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Expires</span>
                  <p className="font-medium">
                    {detail.business.subscription?.expiresAt
                      ? new Date(detail.business.subscription.expiresAt).toLocaleString()
                      : '—'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setAssignOpen(true)}>
                  <Plus className="mr-1 h-3 w-3" /> Assign
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    actionMutation.mutate({ id: selectedId!, action: 'extend', body: { additionalDays: 30 } })
                  }
                >
                  <Clock className="mr-1 h-3 w-3" /> +30 days
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => actionMutation.mutate({ id: selectedId!, action: 'pause' })}
                >
                  <Pause className="mr-1 h-3 w-3" /> Pause
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => actionMutation.mutate({ id: selectedId!, action: 'resume' })}
                >
                  <Play className="mr-1 h-3 w-3" /> Resume
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => actionMutation.mutate({ id: selectedId!, action: 'unlock' })}
                >
                  <Unlock className="mr-1 h-3 w-3" /> Unlock
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => actionMutation.mutate({ id: selectedId!, action: 'suspend' })}
                >
                  <Ban className="mr-1 h-3 w-3" /> Suspend
                </Button>
              </div>

              {detail.activity?.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Activity Log</h4>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded border p-2 text-xs">
                    {detail.activity.slice(0, 10).map((log: { id: string; action: string; createdAt: string }) => (
                      <div key={log.id} className="flex justify-between gap-2">
                        <span>{log.action}</span>
                        <span className="text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Subscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Plan</Label>
              <Select
                value={assignForm.planCode}
                onValueChange={(v) => setAssignForm((f) => ({ ...f, planCode: v }))}
              >
                <SelectTrigger>
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
              <Label>Duration</Label>
              <Select
                value={assignForm.durationPreset}
                onValueChange={(v) => setAssignForm((f) => ({ ...f, durationPreset: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAYS_30">30 Days</SelectItem>
                  <SelectItem value="DAYS_90">90 Days</SelectItem>
                  <SelectItem value="DAYS_180">180 Days</SelectItem>
                  <SelectItem value="DAYS_365">365 Days</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {assignForm.durationPreset === 'CUSTOM' && (
              <div>
                <Label>Custom days</Label>
                <Input
                  type="number"
                  min={1}
                  value={assignForm.customDurationDays}
                  onChange={(e) => setAssignForm((f) => ({ ...f, customDurationDays: e.target.value }))}
                />
              </div>
            )}
            <div>
              <Label>Internal notes</Label>
              <Textarea
                value={assignForm.internalNotes}
                onChange={(e) => setAssignForm((f) => ({ ...f, internalNotes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedId && assignMutation.mutate(selectedId)}
              disabled={assignMutation.isPending}
            >
              Assign & Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
