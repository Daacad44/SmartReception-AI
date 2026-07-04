import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Shield, X } from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import type { GovernanceApprovalRequest } from '@/lib/governance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

interface GovernanceListResponse {
  data: Array<
    GovernanceApprovalRequest & {
      ipAddress?: string;
      userAgent?: string;
      deviceLabel?: string;
      requester?: { firstName: string; lastName: string; email: string };
      approver?: { firstName: string; lastName: string; email: string };
    }
  >;
  meta: { page: number; total: number; totalPages: number };
}

const statusVariant: Record<string, 'secondary' | 'warning' | 'success' | 'destructive'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
  ACTIVATED: 'success',
  EXPIRED: 'secondary',
  CANCELLED: 'secondary',
};

export function GovernanceAdminPage() {
  const [status, setStatus] = useState<string>('PENDING');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['governance', 'admin', status],
    queryFn: async () => {
      const response = await api.get('/super-admin/governance/requests', {
        params: { status, limit: 50 },
      });
      return extractData<GovernanceListResponse['data']>(response) as GovernanceListResponse['data'];
    },
    refetchInterval: 15_000,
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post(`/super-admin/governance/requests/${id}/approve`);
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['governance'] });
      toast.success('Approved — activation code emailed to requester');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const response = await api.post(`/super-admin/governance/requests/${id}/reject`, { reason });
      return extractData(response);
    },
    onSuccess: () => {
      setRejectId(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['governance'] });
      toast.success('Request rejected');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-7 w-7 text-accent" />
            <h1 className="text-2xl font-bold">AI & Integration Governance</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            Review Enterprise approval requests for AI Training and WhatsApp changes.
          </p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="ACTIVATED">Activated</SelectItem>
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
                    <CardTitle className="text-base">{request.actionLabel}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {request.businessName ?? request.businessId} ·{' '}
                      {request.requester
                        ? `${request.requester.firstName} ${request.requester.lastName}`
                        : 'Unknown'}{' '}
                      · {formatRelativeTime(request.createdAt)}
                    </p>
                  </div>
                  <Badge variant={statusVariant[request.status] ?? 'secondary'}>
                    {request.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {request.ipAddress && <span>IP: {request.ipAddress}</span>}
                  {request.deviceLabel && <span>Device: {request.deviceLabel}</span>}
                </div>
                {request.status === 'PENDING' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => approve.mutate(request.id)}
                      disabled={approve.isPending}
                    >
                      <Check className="h-4 w-4" />
                      Approve & Send Code
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => setRejectId(request.id)}
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
                {request.status === 'APPROVED' && (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Awaiting requester activation code entry
                  </p>
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
