import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Check, X, Clock, Loader2, Mail, Phone } from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface Application {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  businessName: string | null;
  approvalStatus: ApplicationStatus;
  approvalCodeExpires: string | null;
  rejectionReason: string | null;
  appliedAt: string;
  approvedAt: string | null;
}

function useApplications(status: ApplicationStatus) {
  return useQuery({
    queryKey: ['admin', 'applications', status],
    queryFn: async () => {
      const res = await api.get(`/super-admin/applications?status=${status}`);
      return extractData<Application[]>(res);
    },
  });
}

export function BusinessApplicationsPage() {
  const [tab, setTab] = useState<ApplicationStatus>('PENDING');

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Building2 className="h-6 w-6 text-accent" />
          Business Applications
        </h1>
        <p className="text-muted-foreground">
          Review new business signups. Approving one emails the applicant an activation code.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ApplicationStatus)}>
        <TabsList>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="APPROVED">Approved</TabsTrigger>
          <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
        </TabsList>
        <TabsContent value="PENDING" className="mt-5">
          <ApplicationList status="PENDING" />
        </TabsContent>
        <TabsContent value="APPROVED" className="mt-5">
          <ApplicationList status="APPROVED" />
        </TabsContent>
        <TabsContent value="REJECTED" className="mt-5">
          <ApplicationList status="REJECTED" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ApplicationList({ status }: { status: ApplicationStatus }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useApplications(status);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] });
  };

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/super-admin/applications/${id}/approve`);
      return extractData<{ message: string }>(res);
    },
    onSuccess: (r) => {
      toast.success(r.message ?? 'Application approved.');
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await api.post(`/super-admin/applications/${id}/reject`, { reason });
      return extractData<{ message: string }>(res);
    },
    onSuccess: () => {
      toast.success('Application rejected.');
      invalidate();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <Card>
        <CardContent className="py-14 text-center text-sm text-muted-foreground">
          No {status.toLowerCase()} applications.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((app) => (
        <Card key={app.id}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  {app.businessName || 'Unnamed business'}
                </CardTitle>
                <CardDescription>
                  {app.firstName} {app.lastName}
                </CardDescription>
              </div>
              <StatusBadge status={app.approvalStatus} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {app.email}
              </span>
              {app.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {app.phone}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {new Date(app.appliedAt).toLocaleDateString()}
              </span>
            </div>

            {app.rejectionReason && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                Reason: {app.rejectionReason}
              </p>
            )}

            {status === 'PENDING' && (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="accent"
                  disabled={approve.isPending || reject.isPending}
                  onClick={() => approve.mutate(app.id)}
                >
                  <Check className="h-4 w-4" />
                  Approve & send code
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={approve.isPending || reject.isPending}
                  onClick={() => {
                    const reason = window.prompt('Reason for rejection (optional):') ?? undefined;
                    reject.mutate({ id: app.id, reason: reason || undefined });
                  }}
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  if (status === 'APPROVED') return <Badge variant="success">Approved</Badge>;
  if (status === 'REJECTED') return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="accent">Pending</Badge>;
}
