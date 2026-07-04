import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Brain,
  FileText,
  Lock,
  RefreshCw,
  Shield,
  Sparkles,
  Rocket,
  History,
  BarChart3,
  Lightbulb,
  ScrollText,
  FlaskConical,
} from 'lucide-react';
import api, { extractData } from '@/lib/api';
import type { GovernanceApprovalRequest, GovernanceCapabilities } from '@/lib/governance';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { BusinessProfileSettings } from '@/components/settings/BusinessProfileSettings';
import { KnowledgeBasePage } from '@/pages/KnowledgeBasePage';
import { ActivationCodeDialog } from '@/components/governance/ActivationCodeDialog';
import { GovernanceApprovalBanner } from '@/components/governance/GovernanceApprovalBanner';
import { SandboxChat } from '@/components/ai-training/SandboxChat';
import { DeploymentPanel, AiTrainingVersionsPanel } from '@/components/ai-training/TrainingPanels';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api';

interface AiTrainingOverview {
  capabilities: GovernanceCapabilities;
  syncStatus: {
    totalDocuments: number;
    indexed: number;
    processing: number;
    failed: number;
    embeddings: number;
    lastUpdated: string;
  };
  pendingApprovals: GovernanceApprovalRequest[];
  pendingGovernance?: GovernanceApprovalRequest[];
  workspace?: {
    aiReadinessScore?: number;
    knowledgeScore?: number;
    confidenceScore?: number;
    sandboxVersion?: { id: string; versionNumber: number };
  };
  aiHealth?: { status: string; readinessScore: number };
  insights?: Array<{ id: string; title: string; description: string; severity: string }>;
  analytics?: {
    conversations: { aiResolutionRate: number; humanHandoverRate: number };
    quality: { failedQuestions: number };
  };
  recentJobs?: Array<{ id: string; status: string; type: string; progress: number }>;
}

export function AITrainingPage() {
  const [searchParams] = useSearchParams();
  const [activationRequest, setActivationRequest] = useState<GovernanceApprovalRequest | null>(null);
  const [activationOpen, setActivationOpen] = useState(
    Boolean(searchParams.get('request'))
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ai-training', 'overview'],
    queryFn: async () => {
      const response = await api.get('/ai-training');
      return extractData<AiTrainingOverview>(response);
    },
    refetchInterval: 30_000,
  });

  const capabilities = data?.capabilities;
  const isReadOnly = capabilities?.aiTrainingAccess === 'readonly';
  const pendingApproval = (data?.pendingApprovals ?? data?.pendingGovernance)?.find(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED'
  );

  const handleApprovalRequired = (request: GovernanceApprovalRequest) => {
    toast.info('Administrator approval required', {
      description: 'Your request was submitted for Super Admin review.',
    });
    refetch();
    if (request.status === 'APPROVED') {
      setActivationRequest(request);
      setActivationOpen(true);
    }
  };

  const handleReindex = async () => {
    try {
      const response = await api.post('/ai-training/reindex');
      if (response.data.approvalRequired) {
        handleApprovalRequired(response.data.data as GovernanceApprovalRequest);
        return;
      }
      toast.success('Re-indexing started');
      refetch();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  if (isError) {
    return <ErrorState message="Unable to load AI Training." />;
  }

  const sync = data?.syncStatus;
  const indexPercent =
    sync && sync.totalDocuments > 0
      ? Math.round((sync.indexed / sync.totalDocuments) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-7 w-7 text-accent" />
            <h1 className="text-2xl font-bold">AI Training Management</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            Enterprise AI workspace — business profile, knowledge library, training, sandbox,
            versioning, and deployment for your business AI.
          </p>
        </div>
        {capabilities && (
          <Badge variant={isReadOnly ? 'secondary' : 'outline'} className="w-fit gap-1">
            {isReadOnly ? <Lock className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
            {capabilities.planCode} ·{' '}
            {isReadOnly ? 'Read-only (Super Admin managed)' : 'Enterprise (approval required)'}
          </Badge>
        )}
      </div>

      {isReadOnly && (
        <Card className="border-muted bg-muted/30">
          <CardContent className="flex items-start gap-3 p-4">
            <Lock className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">View-only access</p>
              <p className="text-sm text-muted-foreground">
                On your plan, AI Training is managed by your Super Administrator. You can review
                content here but cannot upload, edit, or delete training data.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {pendingApproval && (
        <GovernanceApprovalBanner
          request={pendingApproval}
          onEnterCode={
            pendingApproval.status === 'APPROVED'
              ? () => {
                  setActivationRequest(pendingApproval);
                  setActivationOpen(true);
                }
              : undefined
          }
        />
      )}

      {isLoading ? (
        <LoadingState rows={8} />
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <Sparkles className="h-4 w-4" />
              AI Status
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <Bot className="h-4 w-4" />
              Business Information
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText className="h-4 w-4" />
              Knowledge Library
            </TabsTrigger>
            <TabsTrigger value="training" className="gap-2">
              <History className="h-4 w-4" />
              Training
            </TabsTrigger>
            <TabsTrigger value="sandbox" className="gap-2">
              <FlaskConical className="h-4 w-4" />
              Sandbox
            </TabsTrigger>
            <TabsTrigger value="deployment" className="gap-2">
              <Rocket className="h-4 w-4" />
              Production
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2">
              <Lightbulb className="h-4 w-4" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <ScrollText className="h-4 w-4" />
              AI Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    AI Readiness
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data?.workspace?.aiReadinessScore ?? 0}%</p>
                  <Badge variant="outline" className="mt-1">
                    {data?.aiHealth?.status ?? 'unknown'}
                  </Badge>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{sync?.totalDocuments ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Indexed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-600">{sync?.indexed ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Embeddings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{sync?.embeddings ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Processing / Failed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">
                    {sync?.processing ?? 0}
                    <span className="text-muted-foreground"> / </span>
                    <span className="text-destructive">{sync?.failed ?? 0}</span>
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle>AI Index Status</CardTitle>
                <CardDescription>
                  Last updated{' '}
                  {sync?.lastUpdated
                    ? new Date(sync.lastUpdated).toLocaleString()
                    : '—'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>Indexed documents</span>
                    <span>{indexPercent}%</span>
                  </div>
                  <Progress value={indexPercent} className="h-2" />
                </div>
                {!isReadOnly && (
                  <Button variant="outline" onClick={handleReindex} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Re-index AI Knowledge
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <BusinessProfileSettings
              readOnly={isReadOnly}
              onApprovalRequired={handleApprovalRequired}
            />
          </TabsContent>

          <TabsContent value="documents">
            <KnowledgeBasePage
              embedded
              readOnly={isReadOnly}
              onApprovalRequired={handleApprovalRequired}
            />
          </TabsContent>

          <TabsContent value="training">
            <AiTrainingVersionsPanel />
            {data?.recentJobs && data.recentJobs.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Training Queue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.recentJobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between rounded border p-2 text-sm">
                      <span>{job.type}</span>
                      <Badge variant="outline">{job.status}</Badge>
                      <span>{job.progress}%</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="sandbox">
            {data?.workspace?.sandboxVersion ? (
              <SandboxChat versionId={data.workspace.sandboxVersion.id} readOnly={isReadOnly} />
            ) : (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Complete a training run to create a sandbox version for testing.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="deployment">
            <DeploymentPanel readOnly={isReadOnly} />
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">AI Resolution Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data?.analytics?.conversations.aiResolutionRate ?? 0}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Human Handover</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data?.analytics?.conversations.humanHandoverRate ?? 0}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Failed Questions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{data?.analytics?.quality.failedQuestions ?? 0}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="insights">
            <Card>
              <CardHeader>
                <CardTitle>AI Recommendations</CardTitle>
                <CardDescription>Intelligent suggestions to improve your business AI</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data?.insights ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No insights yet. Train your AI to generate recommendations.</p>
                ) : (
                  data?.insights?.map((insight) => (
                    <div key={insight.id} className="rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={insight.severity === 'high' ? 'destructive' : 'secondary'}>
                          {insight.severity}
                        </Badge>
                        <p className="font-medium">{insight.title}</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{insight.description}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Training Audit Logs</CardTitle>
                <CardDescription>Immutable record of all AI training actions</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  View detailed audit logs in Settings → Audit Logs, or use the API at{' '}
                  <code className="text-xs">/ai-training-mgmt/audit-logs</code>.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <ActivationCodeDialog
        open={activationOpen}
        onOpenChange={setActivationOpen}
        request={activationRequest ?? pendingApproval ?? null}
        onActivated={() => refetch()}
      />
    </div>
  );
}
