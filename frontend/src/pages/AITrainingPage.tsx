import { useState } from 'react';
import { Link, useSearchParams, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bot,
  Brain,
  CheckCircle2,
  Circle,
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
import api, { extractData, getErrorMessage } from '@/lib/api';
import type { GovernanceApprovalRequest, GovernanceCapabilities } from '@/lib/governance';
import type { TrainingOperation, TrainingVerificationRequest } from '@/lib/ai-training-center-types';
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
import { SandboxValidationPanel } from '@/components/ai-training/SandboxValidationPanel';
import { DeploymentPanel, AiTrainingVersionsPanel } from '@/components/ai-training/TrainingPanels';
import { TrainingOtpDialog } from '@/components/ai-training/TrainingOtpDialog';
import { toast } from 'sonner';

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

interface AdminBusinessDetail {
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
  sandboxVersionId?: string | null;
  versions: Array<{ id: string; versionNumber: number; status: string; readinessScore?: number | null }>;
  jobs: Array<{ id: string; type: string; status: string; progress: number; currentStep?: string | null }>;
}

const ADMIN_STEPS = [
  { key: 'profile', label: 'Business Info', icon: Bot },
  { key: 'documents', label: 'Knowledge Library', icon: FileText },
  { key: 'training', label: 'Training', icon: History },
  { key: 'sandbox', label: 'Sandbox', icon: FlaskConical },
  { key: 'deployment', label: 'Deployment', icon: Rocket },
] as const;

function StepIndicator({
  currentStep,
  hasSandbox,
  hasProduction,
}: {
  currentStep: string;
  hasSandbox: boolean;
  hasProduction: boolean;
}) {
  const stepStatus = (key: string) => {
    if (key === 'sandbox' && !hasSandbox) return 'locked';
    if (key === 'deployment' && !hasSandbox) return 'locked';
    return 'available';
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {ADMIN_STEPS.map((step, i) => {
        const status = stepStatus(step.key);
        const isCurrent = currentStep === step.key;
        const isComplete =
          (step.key === 'profile') ||
          (step.key === 'documents') ||
          (step.key === 'training' && hasSandbox) ||
          (step.key === 'sandbox' && hasProduction) ||
          (step.key === 'deployment' && hasProduction);

        return (
          <div key={step.key} className="flex items-center">
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isCurrent
                  ? 'bg-accent text-white'
                  : isComplete
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : status === 'locked'
                      ? 'bg-muted text-muted-foreground opacity-50'
                      : 'bg-muted text-muted-foreground'
              }`}
            >
              {isComplete && !isCurrent ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : status === 'locked' ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-3.5 w-3.5" />
              )}
              {step.label}
            </div>
            {i < ADMIN_STEPS.length - 1 && (
              <div className={`mx-1 h-px w-4 ${isComplete ? 'bg-green-400' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AITrainingPage() {
  const { businessId } = useParams<{ businessId?: string }>();
  const isAdmin = Boolean(businessId);
  const [searchParams] = useSearchParams();
  const [activationRequest, setActivationRequest] = useState<GovernanceApprovalRequest | null>(null);
  const [activationOpen, setActivationOpen] = useState(
    Boolean(searchParams.get('request'))
  );
  const [activeTab, setActiveTab] = useState(isAdmin ? 'profile' : 'overview');
  const [otpOpen, setOtpOpen] = useState(false);
  const [verification, setVerification] = useState<TrainingVerificationRequest | null>(null);
  const queryClient = useQueryClient();

  const selfServeQuery = useQuery({
    queryKey: ['ai-training', 'overview'],
    queryFn: async () => {
      const response = await api.get('/ai-training');
      return extractData<AiTrainingOverview>(response);
    },
    refetchInterval: 30_000,
    enabled: !isAdmin,
  });

  const adminQuery = useQuery({
    queryKey: ['enterprise-ai-intelligence', 'business', businessId],
    queryFn: async () =>
      extractData<AdminBusinessDetail>(
        await api.get(`/super-admin/enterprise-ai-intelligence/businesses/${businessId}`)
      ),
    refetchInterval: 15_000,
    enabled: isAdmin,
  });

  const data = selfServeQuery.data;
  const adminData = adminQuery.data;
  const isLoading = isAdmin ? adminQuery.isLoading : selfServeQuery.isLoading;
  const isError = isAdmin ? adminQuery.isError : selfServeQuery.isError;
  const refetch = isAdmin ? adminQuery.refetch : selfServeQuery.refetch;

  const capabilities = data?.capabilities;
  const isReadOnly = isAdmin ? false : capabilities?.aiTrainingAccess === 'readonly';
  const pendingApproval = (data?.pendingApprovals ?? data?.pendingGovernance)?.find(
    (r) => r.status === 'PENDING' || r.status === 'APPROVED'
  );

  const hasSandbox = isAdmin
    ? Boolean(adminData?.sandboxVersionId || adminData?.versions.some((v) => v.status === 'SANDBOX'))
    : Boolean(data?.workspace?.sandboxVersion);
  const hasProduction = isAdmin
    ? Boolean(adminData?.versions.some((v) => v.status === 'PRODUCTION'))
    : Boolean(data?.aiHealth?.readinessScore && data.aiHealth.readinessScore > 0);

  const sandboxVersionId = isAdmin
    ? adminData?.sandboxVersionId ?? adminData?.versions.find((v) => v.status === 'SANDBOX')?.id
    : data?.workspace?.sandboxVersion?.id;

  const requestOperation = useMutation({
    mutationFn: async (params: {
      operation: TrainingOperation;
      businessIds: string[];
    }) => {
      const res = await api.post('/super-admin/enterprise-ai-intelligence/verify/request', params);
      return extractData<TrainingVerificationRequest>(res);
    },
    onSuccess: (result) => {
      setVerification(result);
      setOtpOpen(true);
      toast.message('Verification code sent to your email');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

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

  const handleAdminTrain = () => {
    if (!businessId) return;
    requestOperation.mutate({ operation: 'TRAIN_ONE', businessIds: [businessId] });
  };

  if (isError) {
    return <ErrorState message="Unable to load AI Training." onRetry={() => refetch()} />;
  }

  const sync = data?.syncStatus;
  const indexPercent =
    sync && sync.totalDocuments > 0
      ? Math.round((sync.indexed / sync.totalDocuments) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {isAdmin && (
            <Button variant="ghost" size="sm" asChild className="mt-1">
              <Link to="/admin/enterprise-ai-intelligence">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back
              </Link>
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <Brain className="h-7 w-7 text-accent" />
              <h1 className="text-2xl font-bold">
                {isAdmin ? adminData?.name ?? 'AI Training' : 'AI Training Management'}
              </h1>
            </div>
            <p className="mt-1 text-muted-foreground">
              {isAdmin
                ? `Business ID: ${businessId}`
                : 'Enterprise AI workspace — business profile, knowledge library, training, sandbox, versioning, and deployment for your business AI.'}
            </p>
          </div>
        </div>
        {isAdmin && adminData && (
          <Badge variant="secondary" className="w-fit gap-1">
            {adminData.deploymentStatus ?? adminData.trainingStatus}
          </Badge>
        )}
        {!isAdmin && capabilities && (
          <Badge variant={isReadOnly ? 'secondary' : 'outline'} className="w-fit gap-1">
            {isReadOnly ? <Lock className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
            {capabilities.planCode} ·{' '}
            {isReadOnly ? 'Read-only (Super Admin managed)' : 'Enterprise (approval required)'}
          </Badge>
        )}
      </div>

      {/* Admin step indicator */}
      {isAdmin && !isLoading && (
        <StepIndicator currentStep={activeTab} hasSandbox={hasSandbox} hasProduction={hasProduction} />
      )}

      {/* Read-only banner (business mode) */}
      {!isAdmin && isReadOnly && (
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

      {!isAdmin && pendingApproval && (
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex-wrap">
            {!isAdmin && (
              <TabsTrigger value="overview" className="gap-2">
                <Sparkles className="h-4 w-4" />
                AI Status
              </TabsTrigger>
            )}
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
            <TabsTrigger
              value="sandbox"
              className="gap-2"
              disabled={isAdmin && !hasSandbox}
            >
              <FlaskConical className="h-4 w-4" />
              Sandbox
            </TabsTrigger>
            <TabsTrigger
              value="deployment"
              className="gap-2"
              disabled={isAdmin && !hasSandbox}
            >
              <Rocket className="h-4 w-4" />
              Production
            </TabsTrigger>
            {!isAdmin && (
              <>
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
              </>
            )}
          </TabsList>

          {/* AI Status — business mode only */}
          {!isAdmin && (
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
          )}

          {/* Business Information */}
          <TabsContent value="profile">
            {isAdmin && adminData ? (
              <Card>
                <CardHeader>
                  <CardTitle>Business Profile</CardTitle>
                  <CardDescription>Read-only summary of this business&apos;s profile</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: 'Documents', value: adminData.documents },
                      { label: 'FAQs', value: adminData.faqs },
                      { label: 'Products', value: adminData.products },
                      { label: 'Services', value: adminData.services },
                      { label: 'Embeddings', value: adminData.embeddingsCount },
                      { label: 'Health Score', value: `${Math.round(adminData.knowledgeHealth)}%` },
                      { label: 'AI Version', value: adminData.knowledgeVersion ?? '—' },
                      { label: 'Training Status', value: adminData.trainingStatus },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-lg border p-3">
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-xl font-bold">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <BusinessProfileSettings
                readOnly={isReadOnly}
                onApprovalRequired={handleApprovalRequired}
              />
            )}
          </TabsContent>

          {/* Knowledge Library */}
          <TabsContent value="documents">
            {isAdmin && adminData ? (
              <Card>
                <CardHeader>
                  <CardTitle>Knowledge Library</CardTitle>
                  <CardDescription>
                    Content managed by the business owner through their portal
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border p-3">
                      <p className="text-sm text-muted-foreground">Documents</p>
                      <p className="text-2xl font-bold">{adminData.documents}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-sm text-muted-foreground">FAQs</p>
                      <p className="text-2xl font-bold">{adminData.faqs}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-sm text-muted-foreground">Products</p>
                      <p className="text-2xl font-bold">{adminData.products}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-sm text-muted-foreground">Services</p>
                      <p className="text-2xl font-bold">{adminData.services}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Knowledge Health: {Math.round(adminData.knowledgeHealth)}%
                    </span>
                    <Progress value={adminData.knowledgeHealth} className="ml-2 h-2 max-w-[200px]" />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <KnowledgeBasePage
                embedded
                readOnly={isReadOnly}
                onApprovalRequired={handleApprovalRequired}
              />
            )}
          </TabsContent>

          {/* Training */}
          <TabsContent value="training">
            <AiTrainingVersionsPanel
              businessId={businessId}
              onRequestTrain={isAdmin ? handleAdminTrain : undefined}
            />
            {!isAdmin && data?.recentJobs && data.recentJobs.length > 0 && (
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
            {isAdmin && adminData && adminData.jobs.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Training Jobs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {adminData.jobs.map((job) => (
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

          {/* Sandbox */}
          <TabsContent value="sandbox" className="space-y-4">
            {sandboxVersionId ? (
              <>
                <SandboxChat versionId={sandboxVersionId} readOnly={isReadOnly} />
                <SandboxValidationPanel versionId={sandboxVersionId} />
              </>
            ) : (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Complete a training run to create a sandbox version for testing.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Production / Deployment */}
          <TabsContent value="deployment">
            <DeploymentPanel readOnly={isReadOnly} businessId={businessId} />
          </TabsContent>

          {/* Analytics — business mode only */}
          {!isAdmin && (
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
          )}

          {/* Insights — business mode only */}
          {!isAdmin && (
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
          )}

          {/* AI Logs — business mode only */}
          {!isAdmin && (
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
          )}
        </Tabs>
      )}

      {/* Business-mode activation dialog */}
      {!isAdmin && (
        <ActivationCodeDialog
          open={activationOpen}
          onOpenChange={setActivationOpen}
          request={activationRequest ?? pendingApproval ?? null}
          onActivated={() => refetch()}
        />
      )}

      {/* Admin-mode OTP dialog */}
      {isAdmin && (
        <TrainingOtpDialog
          open={otpOpen}
          onOpenChange={setOtpOpen}
          verification={verification}
          onVerified={() => {
            queryClient.invalidateQueries({ queryKey: ['enterprise-ai-intelligence'] });
          }}
        />
      )}
    </div>
  );
}
