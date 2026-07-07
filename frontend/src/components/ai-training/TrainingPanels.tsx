import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Rocket, RefreshCw } from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface DeploymentRequest {
  id: string;
  status: string;
  knowledgeScore: number | null;
  confidenceScore: number | null;
  readinessScore: number | null;
  version: { versionNumber: number };
  requestedAt: string;
}

interface DeploymentPanelProps {
  readOnly?: boolean;
  businessId?: string;
}

export function DeploymentPanel({ readOnly, businessId }: DeploymentPanelProps) {
  const queryClient = useQueryClient();
  const isAdmin = Boolean(businessId);

  const { data: dashboard } = useQuery({
    queryKey: isAdmin
      ? ['enterprise-ai-intelligence', 'business', businessId]
      : ['ai-training', 'overview'],
    queryFn: async () => {
      if (isAdmin) {
        const response = await api.get(
          `/super-admin/enterprise-ai-intelligence/businesses/${businessId}`
        );
        const detail = await extractData<{
          sandboxVersionId?: string | null;
          versions: Array<{ id: string; versionNumber: number; status: string }>;
          deploymentRequests?: DeploymentRequest[];
        }>(response);
        const sandboxVer = detail.versions.find((v) => v.status === 'SANDBOX');
        return {
          sandboxVersion: sandboxVer
            ? { id: sandboxVer.id, versionNumber: sandboxVer.versionNumber, status: sandboxVer.status }
            : undefined,
          deploymentRequests: detail.deploymentRequests ?? [],
        };
      }
      const response = await api.get('/ai-training');
      return extractData<{
        sandboxVersion?: { id: string; versionNumber: number; status: string };
        deploymentRequests: DeploymentRequest[];
      }>(response);
    },
  });

  const requestDeployment = useMutation({
    mutationFn: async (versionId: string) => {
      const response = await api.post('/ai-training-mgmt/deployments/request', {
        versionId,
        deploymentSummary: 'Sandbox testing completed — requesting production deployment.',
      });
      return extractData(response);
    },
    onSuccess: () => {
      toast.success('Deployment request submitted for Super Admin approval');
      queryClient.invalidateQueries({
        queryKey: isAdmin
          ? ['enterprise-ai-intelligence', 'business', businessId]
          : ['ai-training'],
      });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const sandbox = dashboard?.sandboxVersion;
  const requests = dashboard?.deploymentRequests ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Production Deployment
          </CardTitle>
          <CardDescription>
            AI versions must pass sandbox testing and receive Super Admin approval before going live.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sandbox ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
              <div>
                <p className="font-medium">Sandbox Version {sandbox.versionNumber}</p>
                <Badge variant="secondary">{sandbox.status}</Badge>
              </div>
              {!readOnly && sandbox.status === 'SANDBOX' && (
                <Button
                  onClick={() => requestDeployment.mutate(sandbox.id)}
                  disabled={requestDeployment.isPending}
                  className="gap-2"
                >
                  <Rocket className="h-4 w-4" />
                  Request Deployment
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sandbox version available. Train AI first.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Approval Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deployment requests yet.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div key={req.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div>
                    <p className="font-medium">Version {req.version.versionNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(req.requestedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        req.status === 'DEPLOYED'
                          ? 'default'
                          : req.status === 'REJECTED'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {req.status}
                    </Badge>
                    {req.readinessScore != null && (
                      <span className="text-sm text-muted-foreground">
                        Readiness: {Math.round(req.readinessScore)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface VersionData {
  id: string;
  versionNumber: number;
  status: string;
  knowledgeScore: number | null;
  confidenceScore: number | null;
  readinessScore: number | null;
  createdAt: string;
}

interface AiTrainingVersionsPanelProps {
  businessId?: string;
  onRequestTrain?: () => void;
}

export function AiTrainingVersionsPanel({ businessId, onRequestTrain }: AiTrainingVersionsPanelProps) {
  const isAdmin = Boolean(businessId);

  const { data: dashboard, refetch } = useQuery({
    queryKey: isAdmin
      ? ['enterprise-ai-intelligence', 'business', businessId]
      : ['ai-training', 'overview'],
    queryFn: async () => {
      if (isAdmin) {
        const response = await api.get(
          `/super-admin/enterprise-ai-intelligence/businesses/${businessId}`
        );
        const detail = await extractData<{
          versions: VersionData[];
          knowledgeVersion?: number | null;
          sandboxVersionId?: string | null;
        }>(response);
        const prodVer = detail.versions.find((v) => v.status === 'PRODUCTION');
        const sandboxVer = detail.versions.find((v) => v.status === 'SANDBOX');
        return {
          versions: detail.versions,
          workspace: {
            productionVersion: prodVer ? { versionNumber: prodVer.versionNumber } : undefined,
            sandboxVersion: sandboxVer ? { versionNumber: sandboxVer.versionNumber } : undefined,
          },
        };
      }
      const response = await api.get('/ai-training');
      return extractData<{
        versions: VersionData[];
        workspace: {
          productionVersion?: { versionNumber: number };
          sandboxVersion?: { versionNumber: number };
        };
      }>(response);
    },
  });

  const startTraining = useMutation({
    mutationFn: async () => {
      const response = await api.post('/ai-training-mgmt/train', {
        type: 'FULL_TRAIN',
        trainingNotes: 'Manual training initiated from dashboard',
      });
      return extractData(response);
    },
    onSuccess: () => {
      toast.success('Training job queued');
      refetch();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const versions = dashboard?.versions ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {isAdmin && onRequestTrain ? (
          <Button onClick={onRequestTrain} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Train AI (OTP Required)
          </Button>
        ) : (
          <Button onClick={() => startTraining.mutate()} disabled={startTraining.isPending} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${startTraining.isPending ? 'animate-spin' : ''}`} />
            Train AI
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Production</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {dashboard?.workspace.productionVersion
                ? `v${dashboard.workspace.productionVersion.versionNumber}`
                : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sandbox</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {dashboard?.workspace.sandboxVersion
                ? `v${dashboard.workspace.sandboxVersion.versionNumber}`
                : '—'}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No training versions yet.</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <span className="font-medium">v{v.versionNumber}</span>
                    <Badge className="ml-2" variant="outline">
                      {v.status}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground">
                    Readiness {v.readinessScore ?? '—'}% · {new Date(v.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
