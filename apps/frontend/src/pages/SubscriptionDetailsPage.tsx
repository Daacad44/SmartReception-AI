import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  Clock,
  CreditCard,
  Lock,
  Pause,
  Play,
  Plus,
  Unlock,
  XCircle,
} from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingState } from '@/components/LoadingState';
import { AssignSubscriptionModal } from '@/components/subscription-admin/AssignSubscriptionModal';
import { ExtendSubscriptionModal } from '@/components/subscription-admin/ExtendSubscriptionModal';
import { UsageMetricsGrid } from '@/components/subscription-admin/UsageMetricsGrid';
import { SubscriptionTimeline } from '@/components/subscription-admin/SubscriptionTimeline';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  TRIAL: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  EXPIRED: 'bg-red-500/15 text-red-400 border-red-500/30',
  SUSPENDED: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  LOCKED: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  CANCELLED: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  PENDING: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

const FEATURE_LABELS: Record<string, string> = {
  aiChat: 'AI Chat',
  knowledgeBase: 'Knowledge Base',
  appointments: 'Appointments',
  broadcast: 'Broadcast',
  crm: 'CRM',
  campaigns: 'Campaigns',
  analytics: 'Analytics',
  apiAccess: 'API Access',
  webhookAccess: 'Webhook Access',
  multiBusiness: 'Multi Business',
  whiteLabel: 'White Label',
};

export function SubscriptionDetailsPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['super-admin', 'subscription-detail', businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const res = await api.get(`/super-admin/subscriptions/${businessId}`);
      return res.data.data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscription-detail', businessId] });
    queryClient.invalidateQueries({ queryKey: ['super-admin', 'subscriptions'] });
  };

  const actionMutation = useMutation({
    mutationFn: async ({ action, body }: { action: string; body?: object }) =>
      api.post(`/super-admin/subscriptions/${businessId}/${action}`, body ?? {}),
    onSuccess: () => {
      invalidate();
      toast.success('Subscription updated');
    },
    onError: () => toast.error('Action failed'),
  });

  if (isLoading || !businessId) {
    return (
      <div className="space-y-6">
        <LoadingState rows={6} />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-8 text-center text-slate-400">
        Business not found.{' '}
        <Link to="/admin/subscriptions" className="text-amber-400 hover:underline">
          Back to subscriptions
        </Link>
      </div>
    );
  }

  const business = detail.business;
  const sub = business.subscription;
  const usage = detail.usage;
  const featureFlags = usage?.featureFlags ?? sub?.plan?.featureFlags ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="mb-1 -ml-2 text-slate-400 hover:text-amber-400"
            onClick={() => navigate('/admin/subscriptions')}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Subscriptions
          </Button>
          <h1 className="text-2xl font-bold text-slate-50">{business.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <span>{business.email}</span>
            {business.owner && (
              <>
                <span>·</span>
                <span>
                  {business.owner.name} ({business.owner.email})
                </span>
              </>
            )}
          </div>
        </div>
        <Badge
          variant="outline"
          className={STATUS_COLORS[business.licenseStatus] ?? 'border-slate-700 text-slate-300'}
        >
          {business.licenseStatus}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Current Plan" value={sub?.plan.name ?? 'None'} accent />
        <StatCard
          title="Subscription Status"
          value={sub?.status ?? business.licenseStatus}
        />
        <StatCard
          title="Start Date"
          value={sub?.activatedAt ? new Date(sub.activatedAt).toLocaleDateString() : '—'}
        />
        <StatCard
          title="End Date"
          value={sub?.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : '—'}
        />
        <StatCard title="Remaining Days" value={sub ? String(sub.remainingDays) : '—'} accent />
        <StatCard title="Payment Status" value={sub?.paymentStatus ?? '—'} />
        <StatCard
          title="Last Payment"
          value={sub?.lastPaymentAt ? new Date(sub.lastPaymentAt).toLocaleDateString() : '—'}
        />
        <StatCard
          title="Next Renewal"
          value={sub?.nextRenewalAt ? new Date(sub.nextRenewalAt).toLocaleDateString() : '—'}
        />
      </div>

      <Card className="border-slate-800 bg-slate-950">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base text-slate-200">Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="bg-amber-500 text-slate-950 hover:bg-amber-400"
              onClick={() => setAssignOpen(true)}
            >
              <Plus className="mr-1 h-3 w-3" /> Assign
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setExtendOpen(true)}>
              <Clock className="mr-1 h-3 w-3" /> Extend
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => actionMutation.mutate({ action: 'pause' })}
              disabled={actionMutation.isPending}
            >
              <Pause className="mr-1 h-3 w-3" /> Suspend
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => actionMutation.mutate({ action: 'resume' })}
              disabled={actionMutation.isPending}
            >
              <Play className="mr-1 h-3 w-3" /> Reactivate
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => actionMutation.mutate({ action: 'unlock' })}
              disabled={actionMutation.isPending}
            >
              <Unlock className="mr-1 h-3 w-3" /> Unlock
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => actionMutation.mutate({ action: 'lock' })}
              disabled={actionMutation.isPending}
            >
              <Lock className="mr-1 h-3 w-3" /> Lock
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => actionMutation.mutate({ action: 'cancel' })}
              disabled={actionMutation.isPending}
            >
              <XCircle className="mr-1 h-3 w-3" /> Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => actionMutation.mutate({ action: 'suspend' })}
              disabled={actionMutation.isPending}
            >
              <Ban className="mr-1 h-3 w-3" /> Suspend (hard)
            </Button>
          </div>
        </CardContent>
      </Card>

      {usage && (
        <Card className="border-slate-800 bg-slate-950">
          <CardHeader>
            <CardTitle className="text-base text-slate-200">Usage Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <UsageMetricsGrid usage={usage} />
          </CardContent>
        </Card>
      )}

      {sub?.plan && (
        <Card className="border-slate-800 bg-slate-950">
          <CardHeader>
            <CardTitle className="text-base text-slate-200">Feature Access</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                const enabled = Boolean((featureFlags as Record<string, boolean>)[key]);
                return (
                  <Badge
                    key={key}
                    variant="outline"
                    className={
                      enabled
                        ? 'border-emerald-500/40 text-emerald-400'
                        : 'border-slate-700 text-slate-500'
                    }
                  >
                    {label}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="border border-slate-800 bg-slate-900">
          <TabsTrigger value="activity">Audit Log</TabsTrigger>
          <TabsTrigger value="history">Subscription History</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <Card className="border-slate-800 bg-slate-950">
            <CardHeader>
              <CardTitle className="text-base text-slate-200">Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
              <SubscriptionTimeline
                items={(detail.activity ?? []).map(
                  (log: {
                    id: string;
                    action: string;
                    createdAt: string;
                    performedByEmail?: string | null;
                    notes?: string | null;
                    oldValue?: Record<string, unknown> | null;
                    newValue?: Record<string, unknown> | null;
                  }) => ({
                    id: log.id,
                    action: log.action,
                    createdAt: log.createdAt,
                    performedByEmail: log.performedByEmail,
                    notes: log.notes,
                    oldValue: log.oldValue,
                    newValue: log.newValue,
                  })
                )}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-slate-800 bg-slate-950">
            <CardHeader>
              <CardTitle className="text-base text-slate-200">Subscription History</CardTitle>
            </CardHeader>
            <CardContent>
              {(detail.history ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No history recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400">Action</TableHead>
                      <TableHead className="text-slate-400">Plan</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Expires</TableHead>
                      <TableHead className="text-slate-400">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.history.map(
                      (h: {
                        id: string;
                        action: string;
                        status: string;
                        expiresAt: string | null;
                        createdAt: string;
                        plan?: { name: string } | null;
                      }) => (
                        <TableRow key={h.id} className="border-slate-800">
                          <TableCell>
                            <Badge variant="outline" className="border-slate-700">
                              {h.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-300">{h.plan?.name ?? '—'}</TableCell>
                          <TableCell className="text-slate-300">{h.status}</TableCell>
                          <TableCell className="text-slate-300">
                            {h.expiresAt ? new Date(h.expiresAt).toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell className="text-slate-400">
                            {new Date(h.createdAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="border-slate-800 bg-slate-950">
            <CardHeader className="flex flex-row items-center gap-2">
              <CreditCard className="h-5 w-5 text-amber-400" />
              <CardTitle className="text-base text-slate-200">Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {(detail.payments ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No payments recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400">Amount</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Method</TableHead>
                      <TableHead className="text-slate-400">Reference</TableHead>
                      <TableHead className="text-slate-400">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.payments.map(
                      (p: {
                        id: string;
                        amount: string | number;
                        status: string;
                        paymentMethod: string | null;
                        referenceNumber: string | null;
                        createdAt: string;
                      }) => (
                        <TableRow key={p.id} className="border-slate-800">
                          <TableCell className="font-medium text-slate-200">
                            ${Number(p.amount).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-slate-300">{p.status}</TableCell>
                          <TableCell className="text-slate-300">
                            {p.paymentMethod?.replace(/_/g, ' ') ?? '—'}
                          </TableCell>
                          <TableCell className="text-slate-400">{p.referenceNumber ?? '—'}</TableCell>
                          <TableCell className="text-slate-400">
                            {new Date(p.createdAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="border-slate-800 bg-slate-950">
            <CardHeader>
              <CardTitle className="text-base text-slate-200">Expiration Reminders</CardTitle>
            </CardHeader>
            <CardContent>
              {(detail.notifications ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No notifications scheduled.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400">Type</TableHead>
                      <TableHead className="text-slate-400">Channel</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                      <TableHead className="text-slate-400">Scheduled</TableHead>
                      <TableHead className="text-slate-400">Sent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.notifications.map(
                      (n: {
                        id: string;
                        type: string;
                        channel: string;
                        status: string;
                        scheduledFor: string;
                        sentAt: string | null;
                      }) => (
                        <TableRow key={n.id} className="border-slate-800">
                          <TableCell className="text-slate-300">{n.type}</TableCell>
                          <TableCell className="text-slate-300">{n.channel}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                n.status === 'SENT'
                                  ? 'border-emerald-500/40 text-emerald-400'
                                  : 'border-slate-700 text-slate-400'
                              }
                            >
                              {n.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-400">
                            {new Date(n.scheduledFor).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-slate-400">
                            {n.sentAt ? new Date(n.sentAt).toLocaleString() : '—'}
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {sub?.internalNotes && (
        <Card className="border-slate-800 bg-slate-950">
          <CardHeader>
            <CardTitle className="text-base text-slate-200">Internal Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm text-slate-400">{sub.internalNotes}</pre>
          </CardContent>
        </Card>
      )}

      <AssignSubscriptionModal
        businessId={businessId}
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onSuccess={invalidate}
      />
      <ExtendSubscriptionModal
        businessId={businessId}
        open={extendOpen}
        onOpenChange={setExtendOpen}
        onSuccess={invalidate}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-amber-500/20">
      <p className="text-xs text-slate-500">{title}</p>
      <p className={`mt-1 text-lg font-semibold ${accent ? 'text-amber-400' : 'text-slate-100'}`}>
        {value}
      </p>
    </div>
  );
}
