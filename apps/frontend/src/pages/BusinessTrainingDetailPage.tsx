import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, History, RefreshCw } from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import type {
  TrainingOperation,
  TrainingSessionLog,
  TrainingVerificationRequest,
} from '@/lib/ai-training-center-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/utils';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { TrainingOtpDialog } from '@/components/ai-training/TrainingOtpDialog';
import { toast } from 'sonner';

interface BusinessTrainingDetail {
  businessId: string;
  name: string;
  documents: number;
  faqs: number;
  embeddingsCount: number;
  knowledgeHealth: number;
  trainingStatus: string;
  knowledgeVersion?: number | null;
  versions: Array<{
    id: string;
    versionNumber: number;
    status: string;
    readinessScore?: number | null;
    createdAt: string;
  }>;
  sessions: TrainingSessionLog[];
  jobs: Array<{
    id: string;
    type: string;
    status: string;
    progress: number;
    currentStep?: string | null;
    createdAt: string;
    version?: { versionNumber: number; status: string } | null;
  }>;
}

export function BusinessTrainingDetailPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const queryClient = useQueryClient();
  const [otpOpen, setOtpOpen] = useState(false);
  const [verification, setVerification] = useState<TrainingVerificationRequest | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ai-training-center', 'business', businessId],
    queryFn: async () =>
      extractData<BusinessTrainingDetail>(
        await api.get(`/super-admin/ai-training-center/businesses/${businessId}`)
      ),
    enabled: Boolean(businessId),
    refetchInterval: 15_000,
  });

  const requestOperation = useMutation({
    mutationFn: async (operation: TrainingOperation) => {
      const res = await api.post('/super-admin/ai-training-center/verify/request', {
        operation,
        businessIds: [businessId],
        payload: operation === 'ROLLBACK' ? { versionId: data?.versions[0]?.id } : undefined,
      });
      return extractData<TrainingVerificationRequest>(res);
    },
    onSuccess: (result) => {
      setVerification(result);
      setOtpOpen(true);
      toast.message('Verification code sent to your email');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const preview = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/super-admin/ai-training-center/preview/${businessId}`);
      return extractData(res);
    },
    onSuccess: (result) => {
      toast.success(
        `Preview: ${(result as { preview?: { documents?: number } }).preview?.documents ?? 0} documents, est. cost $${(result as { preview?: { estimatedCost?: number } }).preview?.estimatedCost?.toFixed(4) ?? '0'}`
      );
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isError) {
    return <ErrorState message="Unable to load training details." onRetry={() => refetch()} />;
  }

  if (isLoading || !data) {
    return (
      <div className="p-6">
        <LoadingState rows={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/admin/ai-training">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Training Center
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BookOpen className="h-6 w-6 text-accent" />
            {data.name}
          </h1>
          <p className="text-muted-foreground">Business ID: {businessId}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => requestOperation.mutate('TRAIN_ONE')}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Train
          </Button>
          <Button variant="secondary" onClick={() => requestOperation.mutate('RETRAIN_ONE')}>
            Retrain
          </Button>
          <Button variant="outline" onClick={() => preview.mutate()} disabled={preview.isPending}>
            Preview
          </Button>
          <Button variant="outline" onClick={() => requestOperation.mutate('VALIDATE')}>
            Validate
          </Button>
          <Button variant="outline" onClick={() => requestOperation.mutate('REINDEX')}>
            Reindex
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Documents</p>
            <p className="text-2xl font-bold">{data.documents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Embeddings</p>
            <p className="text-2xl font-bold">{formatNumber(data.embeddingsCount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Knowledge Health</p>
            <p className="text-2xl font-bold">{Math.round(data.knowledgeHealth)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Version</p>
            <p className="text-2xl font-bold">v{data.knowledgeVersion ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Training History
          </CardTitle>
          <CardDescription>Complete session logs — never overwritten</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Started</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Duration</th>
                <th className="pb-2">Embeddings</th>
                <th className="pb-2">Quality</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="py-2">{new Date(s.startedAt).toLocaleString()}</td>
                  <td>{s.trainingType}</td>
                  <td>{s.durationMs ? `${Math.round(s.durationMs / 1000)}s` : '—'}</td>
                  <td>+{s.embeddingsCreated} / ~{s.embeddingsUpdated}</td>
                  <td>{s.qualityScore ?? '—'}</td>
                  <td>
                    <Badge variant={s.status === 'COMPLETED' ? 'default' : 'secondary'}>{s.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Knowledge Versions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.versions.map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">Version {v.versionNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(v.createdAt).toLocaleString()} · Score: {v.readinessScore ?? '—'}
                </p>
              </div>
              <Badge>{v.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <TrainingOtpDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        verification={verification}
        onVerified={() => queryClient.invalidateQueries({ queryKey: ['ai-training-center'] })}
      />
    </div>
  );
}
