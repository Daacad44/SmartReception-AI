import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AiTrainingVersionsPanel } from '@/components/ai-training/TrainingPanels';
import { SandboxChat } from '@/components/ai-training/SandboxChat';
import { toast } from 'sonner';

interface TrainerContext {
  businessId: string;
  token: string | null;
}

function useTrainerApi() {
  const { businessId, token } = useOutletContext<TrainerContext>();
  const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? '/api',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Business-Id': businessId,
    },
  });
  return { client, businessId };
}

export function TrainerDashboardPage() {
  const { client } = useTrainerApi();

  const { data, isLoading } = useQuery({
    queryKey: ['trainer-dashboard'],
    queryFn: async () => {
      const res = await client.get('/trainer-portal/dashboard');
      return res.data.data;
    },
  });

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Training</h1>
        <p className="text-muted-foreground">Train and validate AI for your assigned business</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">AI Readiness</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data?.workspace?.aiReadinessScore ?? 0}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data?.syncStatus?.totalDocuments ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Sandbox</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {data?.workspace?.sandboxVersion
                ? `v${data.workspace.sandboxVersion.versionNumber}`
                : '—'}
            </p>
          </CardContent>
        </Card>
      </div>
      <AiTrainingVersionsPanel />
    </div>
  );
}

export function TrainerJobsPage() {
  const { client } = useTrainerApi();

  const { data } = useQuery({
    queryKey: ['trainer-jobs'],
    queryFn: async () => {
      const res = await client.get('/trainer-portal/jobs');
      return res.data.data as Array<{
        id: string;
        type: string;
        status: string;
        progress: number;
        currentStep: string | null;
      }>;
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Training Jobs</h1>
      {(data ?? []).map((job) => (
        <Card key={job.id}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{job.type}</p>
              <p className="text-sm text-muted-foreground">{job.currentStep ?? 'Queued'}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge>{job.status}</Badge>
              <span className="text-sm">{job.progress}%</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TrainerSandboxPage() {
  const { client } = useTrainerApi();

  const { data } = useQuery({
    queryKey: ['trainer-dashboard'],
    queryFn: async () => {
      const res = await client.get('/trainer-portal/dashboard');
      return res.data.data;
    },
  });

  const sandboxId = data?.workspace?.sandboxVersion?.id;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Sandbox Testing</h1>
      {sandboxId ? (
        <SandboxChat versionId={sandboxId} />
      ) : (
        <Card>
          <CardContent className="p-6 text-muted-foreground">
            No sandbox version available. Complete a training job first.
            <Button
              className="mt-4"
              onClick={async () => {
                try {
                  await client.post('/trainer-portal/train', { type: 'FULL_TRAIN' });
                  toast.success('Training started');
                } catch {
                  toast.error('Failed to start training');
                }
              }}
            >
              Start Training
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
