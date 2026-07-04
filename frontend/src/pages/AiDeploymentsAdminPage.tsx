import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X, Rocket, RefreshCw } from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface DeploymentRequest {
  id: string;
  status: string;
  business: { name: string };
  version: { versionNumber: number };
  knowledgeScore: number | null;
  confidenceScore: number | null;
  readinessScore: number | null;
  requestedAt: string;
  requestedByTrainer?: { firstName: string; lastName: string };
  requestedByUser?: { firstName: string; lastName: string };
}

export function AiDeploymentsAdminPage() {
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['ai-deployments'],
    queryFn: async () => {
      const response = await api.get('/super-admin/ai-training/deployments');
      return extractData<DeploymentRequest[]>(response);
    },
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/super-admin/ai-training/deployments/${id}/approve`),
    onSuccess: () => {
      toast.success('Deployment approved');
      queryClient.invalidateQueries({ queryKey: ['ai-deployments'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const reject = useMutation({
    mutationFn: (id: string) =>
      api.post(`/super-admin/ai-training/deployments/${id}/reject`, { reason: 'Rejected by Super Admin' }),
    onSuccess: () => {
      toast.success('Deployment rejected');
      queryClient.invalidateQueries({ queryKey: ['ai-deployments'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const publish = useMutation({
    mutationFn: (id: string) => api.post(`/super-admin/ai-training/deployments/${id}/publish`),
    onSuccess: () => {
      toast.success('Published to production');
      queryClient.invalidateQueries({ queryKey: ['ai-deployments'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Deployment Approvals</h1>
        <p className="text-muted-foreground">
          Review sandbox-tested AI versions before publishing to production
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-4">
          {(requests ?? []).map((req) => {
            const requester = req.requestedByTrainer
              ? `${req.requestedByTrainer.firstName} ${req.requestedByTrainer.lastName}`
              : req.requestedByUser
                ? `${req.requestedByUser.firstName} ${req.requestedByUser.lastName}`
                : 'Unknown';

            return (
              <Card key={req.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {req.business.name} — v{req.version.versionNumber}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Trainer: {requester} · {new Date(req.requestedAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge>{req.status}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span>Knowledge: {req.knowledgeScore ?? '—'}%</span>
                    <span>Confidence: {req.confidenceScore ?? '—'}%</span>
                    <span>Readiness: {req.readinessScore ?? '—'}%</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {req.status === 'PENDING' && (
                      <>
                        <Button size="sm" className="gap-1" onClick={() => approve.mutate(req.id)}>
                          <Check className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1"
                          onClick={() => reject.mutate(req.id)}
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </Button>
                      </>
                    )}
                    {req.status === 'APPROVED' && (
                      <Button size="sm" className="gap-1" onClick={() => publish.mutate(req.id)}>
                        <Rocket className="h-4 w-4" />
                        Publish to Production
                      </Button>
                    )}
                    {req.status === 'DEPLOYED' && (
                      <Badge variant="default" className="gap-1">
                        <RefreshCw className="h-3 w-3" />
                        Live
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
