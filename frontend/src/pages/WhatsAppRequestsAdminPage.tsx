import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, MessageCircle, X } from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import type { WhatsAppConnectionRequestAdmin } from '@/lib/governance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingState } from '@/components/LoadingState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/utils';

const statusVariant: Record<string, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
  EXPIRED: 'secondary',
  CONNECTED: 'success',
};

const PRESETS: Array<{ label: string; minutes: number }> = [
  { label: '1 hour', minutes: 60 },
  { label: '24 hours', minutes: 60 * 24 },
  { label: '72 hours', minutes: 60 * 72 },
];

function ApproveControls({
  requestId,
  onApprove,
  pending,
}: {
  requestId: string;
  onApprove: (id: string, body: { windowMinutes?: number; windowExpiresAt?: string }) => void;
  pending: boolean;
}) {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [minutes, setMinutes] = useState<number>(PRESETS[1].minutes);
  const [customAt, setCustomAt] = useState<string>('');

  const submit = () => {
    if (mode === 'custom') {
      if (!customAt) {
        toast.error('Pick a window expiry date/time');
        return;
      }
      onApprove(requestId, { windowExpiresAt: new Date(customAt).toISOString() });
    } else {
      onApprove(requestId, { windowMinutes: minutes });
    }
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Approve with a connection window</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Window type</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as 'preset' | 'custom')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="preset">Duration preset</SelectItem>
              <SelectItem value="custom">Exact date/time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mode === 'preset' ? (
          <div className="space-y-1">
            <Label className="text-xs">Duration</Label>
            <Select value={String(minutes)} onValueChange={(v) => setMinutes(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.minutes} value={String(p.minutes)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs">Window closes at</Label>
            <Input
              type="datetime-local"
              value={customAt}
              onChange={(e) => setCustomAt(e.target.value)}
              className="w-[220px]"
            />
          </div>
        )}

        <Button size="sm" className="gap-1" onClick={submit} disabled={pending}>
          <Check className="h-4 w-4" />
          Approve
        </Button>
      </div>
    </div>
  );
}

export function WhatsAppRequestsAdminPage() {
  const [status, setStatus] = useState<string>('PENDING');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-requests', 'admin', status],
    queryFn: async () => {
      const response = await api.get('/super-admin/whatsapp/connection-requests', {
        params: { status, limit: 50 },
      });
      return extractData<WhatsAppConnectionRequestAdmin[]>(response);
    },
    refetchInterval: 15_000,
  });

  const approve = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: { windowMinutes?: number; windowExpiresAt?: string };
    }) => {
      const response = await api.post(
        `/super-admin/whatsapp/connection-requests/${id}/approve`,
        body
      );
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-requests'] });
      toast.success('Approved — connection window opened for the business');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await api.post(
        `/super-admin/whatsapp/connection-requests/${id}/reject`,
        { reason }
      );
      return extractData(response);
    },
    onSuccess: () => {
      setRejectId(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-requests'] });
      toast.success('Request rejected');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-7 w-7 text-accent" />
            <h1 className="text-2xl font-bold">WhatsApp Connection Requests</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            Approve a time-limited window for a business to connect their own WhatsApp, or reject the
            request.
          </p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="CONNECTED">Connected</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState rows={6} />
      ) : !data?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No {status.toLowerCase()} requests.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.map((request) => (
            <Card key={request.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      {request.businessName ?? request.businessId}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {request.requester
                        ? `${request.requester.firstName} ${request.requester.lastName}`
                        : 'Unknown'}{' '}
                      · requested {formatRelativeTime(request.requestedAt)}
                    </p>
                  </div>
                  <Badge variant={statusVariant[request.status] ?? 'secondary'}>
                    {request.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {request.status === 'APPROVED' && request.windowExpiresAt && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Window closes {new Date(request.windowExpiresAt).toLocaleString()}
                  </p>
                )}
                {request.status === 'CONNECTED' && request.connectedAt && (
                  <p className="text-sm text-muted-foreground">
                    Connected {formatRelativeTime(request.connectedAt)}
                  </p>
                )}
                {request.status === 'REJECTED' && request.rejectionReason && (
                  <p className="text-sm text-muted-foreground">Reason: {request.rejectionReason}</p>
                )}

                {request.status === 'PENDING' && (
                  <>
                    <ApproveControls
                      requestId={request.id}
                      pending={approve.isPending}
                      onApprove={(id, body) => approve.mutate({ id, body })}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => setRejectId(request.id)}
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                  </>
                )}

                {rejectId === request.id && (
                  <div className="space-y-2 rounded-lg border p-3">
                    <Textarea
                      placeholder="Rejection reason (optional)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          reject.mutate({ id: request.id, reason: rejectReason || undefined })
                        }
                        disabled={reject.isPending}
                      >
                        Confirm Reject
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRejectId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
