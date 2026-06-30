import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, FlaskConical, History, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import type { TrainingOperation, TrainingSessionLog, TrainingVerificationRequest } from '@/lib/ai-training-center-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatNumber } from '@/lib/utils';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { TrainingOtpDialog } from '@/components/ai-training/TrainingOtpDialog';
import { SandboxChat } from '@/components/ai-training/SandboxChat';
import { toast } from 'sonner';

interface BusinessDetail {
  businessId: string;
  name: string;
  documents: number;
  faqs: number;
  products: number;
  services: number;
  embeddingsCount: number;
  knowledgeHealth: number;
  trainingStatus: string;
  deploymentStatus?: string;
  knowledgeVersion?: number | null;
  validationReport?: {
    validationScore?: number;
    passed?: boolean;
    incorrectAnswers?: Array<{ question: string; aiAnswer: string }>;
  } | null;
  sandboxVersionId?: string | null;
  versions: Array<{ id: string; versionNumber: number; status: string; readinessScore?: number | null }>;
  sessions: TrainingSessionLog[];
  jobs: Array<{ id: string; type: string; status: string; progress: number; currentStep?: string | null }>;
  uploadCenter?: { supportedFormats: string[] };
}

export function EnterpriseAiIntelligenceBusinessPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const queryClient = useQueryClient();
  const [otpOpen, setOtpOpen] = useState(false);
  const [verification, setVerification] = useState<TrainingVerificationRequest | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['enterprise-ai-intelligence', 'business', businessId],
    queryFn: async () =>
      extractData<BusinessDetail>(
        await api.get(`/super-admin/enterprise-ai-intelligence/businesses/${businessId}`)
      ),
    enabled: Boolean(businessId),
    refetchInterval: 15_000,
  });

  const requestOperation = useMutation({
    mutationFn: async (operation: TrainingOperation) => {
      const res = await api.post('/super-admin/enterprise-ai-intelligence/verify/request', {
        operation,
        businessIds: [businessId],
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

  if (isError) {
    return <ErrorState message="Unable to load business AI intelligence." onRetry={() => refetch()} />;
  }

  if (isLoading || !data) {
    return <LoadingState rows={8} />;
  }

  const sandboxVersionId = data.sandboxVersionId ?? data.versions.find((v) => v.status === 'SANDBOX')?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin/enterprise-ai-intelligence">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{data.name}</h1>
          <p className="text-sm text-muted-foreground">Business ID: {data.businessId}</p>
        </div>
        <Badge className="ml-auto">{data.deploymentStatus ?? data.trainingStatus}</Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="upload">Upload Center</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="playground">Testing Playground</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Documents', value: data.documents },
              { label: 'FAQs', value: data.faqs },
              { label: 'Products', value: data.products },
              { label: 'Services', value: data.services },
              { label: 'Embeddings', value: data.embeddingsCount },
              { label: 'Health Score', value: `${Math.round(data.knowledgeHealth)}%` },
              { label: 'AI Version', value: data.knowledgeVersion ?? '—' },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-bold">{typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => requestOperation.mutate('TRAIN_ONE')}><RefreshCw className="mr-2 h-4 w-4" />Train</Button>
            <Button variant="secondary" onClick={() => requestOperation.mutate('RETRAIN_ONE')}>Retrain</Button>
            <Button variant="outline" onClick={() => requestOperation.mutate('VALIDATE')}>Validate</Button>
          </div>
        </TabsContent>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4" />Upload Center</CardTitle>
              <CardDescription>All uploads are isolated by Business ID. Processing runs automatically after upload.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(data.uploadCenter?.supportedFormats ?? []).map((format) => (
                  <Badge key={format} variant="secondary">{format}</Badge>
                ))}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Tenants upload via their Enterprise AI Intelligence workspace. Files are validated, extracted, chunked, embedded, and indexed automatically.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validation">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />AI Validation Center</CardTitle>
              <CardDescription>Mandatory validation after every training run</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.validationReport ? (
                <>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Validation Score</p>
                      <p className="text-2xl font-bold">{data.validationReport.validationScore ?? '—'}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant={data.validationReport.passed ? 'default' : 'destructive'}>
                        {data.validationReport.passed ? 'Passed' : 'Validation Failed'}
                      </Badge>
                    </div>
                  </div>
                  {(data.validationReport.incorrectAnswers ?? []).length > 0 && (
                    <div className="space-y-2">
                      <p className="font-medium">Incorrect Answers</p>
                      {data.validationReport.incorrectAnswers!.map((item, i) => (
                        <div key={i} className="rounded-lg border p-3 text-sm">
                          <p className="font-medium">{item.question}</p>
                          <p className="text-muted-foreground">{item.aiAnswer}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No validation report yet. Run training to generate one.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="playground">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4" />AI Testing Playground</CardTitle>
              <CardDescription>Chat with the trained AI. Answers come only from verified uploaded knowledge.</CardDescription>
            </CardHeader>
            <CardContent>
              {sandboxVersionId ? (
                <SandboxChat versionId={sandboxVersionId} />
              ) : (
                <p className="text-sm text-muted-foreground">No sandbox version available. Complete training first.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" />Training Jobs</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between border-b py-2">
                  <span>{job.type}</span>
                  <Badge variant="secondary">{job.status} · {job.progress}%</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" />Session History</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between border-b py-2">
                  <span>{session.trainingType}</span>
                  <Badge variant="secondary">{session.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TrainingOtpDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        verification={verification}
        onVerified={() => queryClient.invalidateQueries({ queryKey: ['enterprise-ai-intelligence'] })}
      />
    </div>
  );
}
