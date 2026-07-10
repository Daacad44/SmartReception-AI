import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bot,
  Brain,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileText,
  FlaskConical,
  Gauge,
  History,
  Info,
  LayoutDashboard,
  Library,
  Lightbulb,
  Rocket,
  ScrollText,
  Send,
  Settings2,
  Sparkles,
  Zap,
} from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import type {
  TrainingBusinessCard,
  TrainingOperation,
  TrainingSessionLog,
  TrainingVerificationRequest,
} from '@/lib/ai-training-center-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { DeploymentPanel, AiTrainingVersionsPanel } from '@/components/ai-training/TrainingPanels';
import { TrainingOtpDialog } from '@/components/ai-training/TrainingOtpDialog';
import { formatNumber } from '@/lib/utils';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types — the workspace is driven entirely by the Super Admin business-scoped
// endpoints, so every business gets an isolated AI environment.
// ---------------------------------------------------------------------------

interface WorkspaceVersion {
  id: string;
  versionNumber: number;
  status: string;
  knowledgeScore?: number | null;
  confidenceScore?: number | null;
  readinessScore?: number | null;
  createdAt: string;
}

interface DeploymentRecord {
  id: string;
  status: string;
  knowledgeScore?: number | null;
  confidenceScore?: number | null;
  readinessScore?: number | null;
  deploymentSummary?: string | null;
  requestedAt: string;
  deployedAt?: string | null;
  reviewedAt?: string | null;
  version?: { versionNumber: number } | null;
  requestedByUser?: { firstName: string; lastName: string } | null;
  requestedByTrainer?: { firstName: string; lastName: string } | null;
  approvedByUser?: { firstName: string; lastName: string } | null;
}

interface WorkspaceInsight {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: string;
  createdAt: string;
}

interface BusinessWorkspaceDetail extends TrainingBusinessCard {
  deploymentStatus: string;
  versions: WorkspaceVersion[];
  sessions: TrainingSessionLog[];
  jobs: Array<{
    id: string;
    type: string;
    status: string;
    progress: number;
    currentStep?: string | null;
    createdAt: string;
    completedAt?: string | null;
    version?: { versionNumber: number; status: string } | null;
    createdByUser?: { firstName: string; lastName: string } | null;
  }>;
  insights: WorkspaceInsight[];
  deployments: DeploymentRecord[];
  validationReport?: Record<string, unknown> | null;
  uploadCenter?: { supportedFormats: string[]; businessIsolation: boolean };
}

interface WorkspaceAnalytics {
  period: string;
  conversations: {
    total: number;
    aiHandled: number;
    humanHandover: number;
    aiResolutionRate: number;
    humanHandoverRate: number;
  };
  messages: { ai: number; human: number };
  knowledge: { documentCount: number; embeddingCount: number; knowledgeScore: number; openInsights: number };
  training: { retrainingFrequency: number; versions: WorkspaceVersion[]; lastTrainedAt?: string | null };
  quality: { aiReadinessScore: number; confidenceScore: number; failedQuestions: number };
  usage: { estimatedTokens: number; embeddingUsage: number };
}

interface AuditLogRecord {
  id: string;
  action: string;
  entity?: string | null;
  createdAt: string;
  deviceLabel?: string | null;
  user?: { firstName: string; lastName: string; email: string } | null;
  trainer?: { firstName: string; lastName: string; username: string } | null;
  version?: { versionNumber: number } | null;
}

type SectionKey =
  | 'overview'
  | 'business'
  | 'knowledge'
  | 'training'
  | 'sandbox'
  | 'production'
  | 'analytics'
  | 'insights'
  | 'logs'
  | 'deployments'
  | 'versions'
  | 'settings';

const SECTIONS: Array<{ key: SectionKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'business', label: 'Business Information', icon: Building2 },
  { key: 'knowledge', label: 'Knowledge Library', icon: Library },
  { key: 'training', label: 'Training', icon: Brain },
  { key: 'sandbox', label: 'Sandbox', icon: FlaskConical },
  { key: 'production', label: 'Production', icon: Rocket },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'insights', label: 'Insights', icon: Lightbulb },
  { key: 'logs', label: 'AI Logs', icon: ScrollText },
  { key: 'deployments', label: 'Deployment History', icon: History },
  { key: 'versions', label: 'Versions', icon: Database },
  { key: 'settings', label: 'Settings', icon: Settings2 },
];

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function fmtDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function fmtDay(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function scoreTone(score: number): string {
  if (score >= 70) return 'text-emerald-500';
  if (score >= 40) return 'text-amber-500';
  return 'text-red-500';
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: typeof LayoutDashboard;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <p className="mt-2 text-2xl font-bold">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function ScoreRing({ label, score }: { label: string; score: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`text-lg font-bold ${scoreTone(clamped)}`}>{clamped}%</span>
      </div>
      <Progress value={clamped} className="mt-2" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function BusinessAiWorkspacePage() {
  const { businessId } = useParams<{ businessId: string }>();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<SectionKey>('overview');
  const [otpOpen, setOtpOpen] = useState(false);
  const [verification, setVerification] = useState<TrainingVerificationRequest | null>(null);

  const detailQuery = useQuery({
    queryKey: ['ai-workspace', 'detail', businessId],
    queryFn: async () =>
      extractData<BusinessWorkspaceDetail>(
        await api.get(`/super-admin/enterprise-ai-intelligence/businesses/${businessId}`)
      ),
    enabled: Boolean(businessId),
    refetchInterval: 20_000,
  });

  const analyticsQuery = useQuery({
    queryKey: ['ai-workspace', 'analytics', businessId],
    queryFn: async () =>
      extractData<WorkspaceAnalytics>(
        await api.get(`/super-admin/enterprise-ai-intelligence/businesses/${businessId}/analytics`)
      ),
    enabled: Boolean(businessId) && section === 'analytics',
  });

  const logsQuery = useQuery({
    queryKey: ['ai-workspace', 'logs', businessId],
    queryFn: async () =>
      extractData<AuditLogRecord[]>(
        await api.get(`/super-admin/enterprise-ai-intelligence/businesses/${businessId}/audit-logs`)
      ),
    enabled: Boolean(businessId) && section === 'logs',
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

  if (detailQuery.isError) {
    return (
      <ErrorState
        message="Unable to load this business AI workspace."
        onRetry={() => detailQuery.refetch()}
      />
    );
  }

  if (detailQuery.isLoading || !detailQuery.data) {
    return <LoadingState rows={8} />;
  }

  const detail = detailQuery.data;
  const productionVersion = detail.versions.find((v) => v.status === 'PRODUCTION');
  const sandboxVersion = detail.versions.find((v) => v.status === 'SANDBOX');
  const latestDeployment = detail.deployments[0];
  const pendingApprovals = detail.deployments.filter(
    (d) => d.status === 'PENDING' || d.status === 'CHANGES_REQUESTED'
  ).length;
  const readiness = Math.round(detail.trainingHealthScore ?? detail.knowledgeHealth ?? 0);
  const knowledgeHealth = Math.round(detail.knowledgeHealth ?? 0);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Button variant="ghost" size="sm" asChild className="-ml-2 gap-2 text-muted-foreground">
        <Link to="/admin/enterprise-ai-intelligence">
          <ArrowLeft className="h-4 w-4" />
          AI Training Management
        </Link>
      </Button>

      {/* ---- Workspace Header ---- */}
      <Card className="overflow-hidden">
        <div className="border-b bg-gradient-to-r from-navy/5 to-accent/5 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-navy text-white">
                {detail.logoUrl ? (
                  <img src={detail.logoUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <Building2 className="h-7 w-7" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{detail.name}</h1>
                  <Badge variant={detail.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {detail.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {detail.industry || 'Business'} · Enterprise AI Workspace · ID {detail.businessId.slice(0, 8)}…
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Rocket className="h-3 w-3" />
                {detail.deploymentStatus === 'DEPLOYED' ? 'Deployed' : 'Not Deployed'}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Activity className="h-3 w-3" />
                {detail.trainingStatus}
              </Badge>
            </div>
          </div>

          {/* Header metrics strip */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <HeaderMetric label="Current AI Version" value={detail.knowledgeVersion ? `v${detail.knowledgeVersion}` : '—'} sub={detail.aiVersion} />
            <HeaderMetric label="Production Version" value={productionVersion ? `v${productionVersion.versionNumber}` : '—'} sub={detail.currentAiProvider} />
            <HeaderMetric label="Last Training" value={fmtDay(detail.lastTraining)} />
            <HeaderMetric label="Last Deployment" value={fmtDay(latestDeployment?.deployedAt ?? latestDeployment?.requestedAt)} />
            <HeaderMetric label="Knowledge Health" value={<span className={scoreTone(knowledgeHealth)}>{knowledgeHealth}%</span>} />
            <HeaderMetric label="AI Readiness" value={<span className={scoreTone(readiness)}>{readiness}%</span>} />
          </div>
        </div>
      </Card>

      {/* ---- Body: sidebar + content ---- */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left sidebar */}
        <nav className="lg:w-56 lg:flex-shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = section === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSection(s.key)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-navy text-white'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {s.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-6">
          {section === 'overview' && (
            <OverviewSection
              detail={detail}
              productionVersion={productionVersion}
              pendingApprovals={pendingApprovals}
              readiness={readiness}
              knowledgeHealth={knowledgeHealth}
            />
          )}
          {section === 'business' && <BusinessInfoSection detail={detail} />}
          {section === 'knowledge' && <KnowledgeLibrarySection detail={detail} />}
          {section === 'training' && (
            <TrainingSection
              businessId={detail.businessId}
              detail={detail}
              onRequestTrain={() => requestOperation.mutate('TRAIN_ONE')}
              onRequestRetrain={() => requestOperation.mutate('RETRAIN_ONE')}
            />
          )}
          {section === 'sandbox' && (
            <SandboxSection businessId={detail.businessId} sandboxVersion={sandboxVersion} />
          )}
          {section === 'production' && (
            <ProductionSection businessId={detail.businessId} productionVersion={productionVersion} />
          )}
          {section === 'analytics' && (
            <AnalyticsSection query={analyticsQuery} />
          )}
          {section === 'insights' && <InsightsSection insights={detail.insights} />}
          {section === 'logs' && <AiLogsSection detail={detail} query={logsQuery} />}
          {section === 'deployments' && <DeploymentHistorySection deployments={detail.deployments} />}
          {section === 'versions' && (
            <AiTrainingVersionsPanel
              businessId={detail.businessId}
              onRequestTrain={() => requestOperation.mutate('TRAIN_ONE')}
            />
          )}
          {section === 'settings' && <SettingsSection detail={detail} />}
        </div>
      </div>

      <TrainingOtpDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        verification={verification}
        onVerified={() => {
          queryClient.invalidateQueries({ queryKey: ['ai-workspace'] });
          toast.success('Operation authorized and queued');
        }}
      />
    </div>
  );
}

function HeaderMetric({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string | null }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-lg font-bold">{value}</p>
      {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function OverviewSection({
  detail,
  productionVersion,
  pendingApprovals,
  readiness,
  knowledgeHealth,
}: {
  detail: BusinessWorkspaceDetail;
  productionVersion?: WorkspaceVersion;
  pendingApprovals: number;
  readiness: number;
  knowledgeHealth: number;
}) {
  const coverage = detail.knowledgeBaseSize > 0 ? Math.min(100, knowledgeHealth) : 0;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ScoreRing label="Knowledge Health" score={knowledgeHealth} />
        <ScoreRing label="AI Readiness" score={readiness} />
        <ScoreRing label="Knowledge Coverage" score={coverage} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Embedding Status" value={detail.embeddingStatus} hint={`${formatNumber(detail.embeddingsCount)} embeddings`} icon={Zap} />
        <StatTile label="Documents" value={formatNumber(detail.documents)} icon={FileText} />
        <StatTile label="FAQs" value={formatNumber(detail.faqs)} icon={Info} />
        <StatTile label="Products" value={formatNumber(detail.products)} icon={Library} />
        <StatTile label="Services" value={formatNumber(detail.services)} icon={Bot} />
        <StatTile label="Training Status" value={detail.trainingStatus} icon={Activity} />
        <StatTile label="Current AI Version" value={detail.knowledgeVersion ? `v${detail.knowledgeVersion}` : '—'} icon={Sparkles} />
        <StatTile label="Production Version" value={productionVersion ? `v${productionVersion.versionNumber}` : '—'} icon={Rocket} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatTile
          label="Last Deployment"
          value={fmtDay(detail.deployments[0]?.deployedAt ?? detail.deployments[0]?.requestedAt)}
          hint={detail.deployments[0]?.version ? `Version ${detail.deployments[0].version.versionNumber}` : 'No deployments yet'}
          icon={History}
        />
        <StatTile
          label="Pending Approval"
          value={pendingApprovals}
          hint={pendingApprovals > 0 ? 'Awaiting Super Admin review' : 'Nothing pending'}
          icon={ClipboardCheck}
        />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value || '—'}</span>
    </div>
  );
}

function BusinessInfoSection({ detail }: { detail: BusinessWorkspaceDetail }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            Business Profile
          </CardTitle>
          <CardDescription>Identity and AI-facing configuration for this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-0 sm:grid-cols-2">
          <InfoRow label="Business Name" value={detail.name} />
          <InfoRow label="Industry" value={detail.industry} />
          <InfoRow label="Status" value={detail.status} />
          <InfoRow label="Business ID" value={<code className="text-xs">{detail.businessId}</code>} />
          <InfoRow label="Model Provider" value={detail.currentAiProvider} />
          <InfoRow label="Embedding Model" value={detail.aiVersion} />
          <InfoRow label="Deployment Status" value={detail.deploymentStatus} />
          <InfoRow label="Knowledge Version" value={detail.knowledgeVersion ? `v${detail.knowledgeVersion}` : '—'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Knowledge Composition</CardTitle>
          <CardDescription>
            Every business owns an isolated knowledge base — training here never affects another business.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile label="Documents" value={formatNumber(detail.documents)} />
          <StatTile label="FAQs" value={formatNumber(detail.faqs)} />
          <StatTile label="Products" value={formatNumber(detail.products)} />
          <StatTile label="Services" value={formatNumber(detail.services)} />
        </CardContent>
      </Card>
    </div>
  );
}

function KnowledgeLibrarySection({ detail }: { detail: BusinessWorkspaceDetail }) {
  const formats = detail.uploadCenter?.supportedFormats ?? [
    'PDF',
    'DOCX',
    'TXT',
    'CSV',
    'Markdown',
    'HTML',
  ];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Library className="h-4 w-4" />
            Knowledge Library
          </CardTitle>
          <CardDescription>
            Uploaded documents are automatically parsed, embedded, indexed, versioned and scoped to this business.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Documents" value={formatNumber(detail.documents)} icon={FileText} />
            <StatTile label="FAQs" value={formatNumber(detail.faqs)} icon={Info} />
            <StatTile label="Embeddings" value={formatNumber(detail.embeddingsCount)} icon={Zap} />
            <StatTile label="Embedding Status" value={detail.embeddingStatus} icon={Database} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Supported Formats
            </p>
            <div className="flex flex-wrap gap-2">
              {formats.map((f) => (
                <Badge key={f} variant="secondary">
                  {f}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Ingestion &amp; Embedding Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No processing runs recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {detail.sessions.slice(0, 8).map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                  <div>
                    <span className="font-medium">{s.trainingType}</span>
                    <p className="text-xs text-muted-foreground">{fmtDate(s.startedAt)}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{s.documentsCount} docs</span>
                    <span>{s.faqCount} FAQs</span>
                    <span>+{s.embeddingsCreated} embeddings</span>
                    <Badge variant={s.status === 'COMPLETED' ? 'default' : s.status === 'FAILED' ? 'destructive' : 'secondary'}>
                      {s.status}
                    </Badge>
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

const PIPELINE_STEPS = [
  'Upload Documents',
  'Validate',
  'Generate Embeddings',
  'Train AI',
  'Knowledge Validation',
  'Training Report',
  'Sandbox',
];

function TrainingSection({
  detail,
  onRequestTrain,
  onRequestRetrain,
}: {
  businessId: string;
  detail: BusinessWorkspaceDetail;
  onRequestTrain: () => void;
  onRequestRetrain: () => void;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4" />
              Training Pipeline
            </CardTitle>
            <CardDescription>
              Training requires Super Admin authorization (OTP). Successful training lands in Sandbox — never Production.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onRequestRetrain} className="gap-2">
              Retrain
            </Button>
            <Button size="sm" onClick={onRequestTrain} className="gap-2">
              <Zap className="h-4 w-4" />
              Train AI (OTP)
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[10px] text-white">
                    {i + 1}
                  </span>
                  {step}
                </div>
                {i < PIPELINE_STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Training Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No training jobs yet.</p>
          ) : (
            <div className="space-y-2">
              {detail.jobs.slice(0, 12).map((job) => (
                <div key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{job.type}</span>
                      {job.version && <Badge variant="outline">v{job.version.versionNumber}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(job.createdAt)}
                      {job.createdByUser && ` · ${job.createdByUser.firstName} ${job.createdByUser.lastName}`}
                      {job.currentStep && ` · ${job.currentStep}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {['RUNNING', 'QUEUED'].includes(job.status) && (
                      <div className="w-24">
                        <Progress value={job.progress} />
                      </div>
                    )}
                    <Badge
                      variant={
                        job.status === 'COMPLETED'
                          ? 'default'
                          : job.status === 'FAILED'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {job.status}
                    </Badge>
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

function SandboxSection({
  businessId,
  sandboxVersion,
}: {
  businessId: string;
  sandboxVersion?: WorkspaceVersion;
}) {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  // Playground replies are returned inline by the send-message endpoint, so we
  // keep the transcript in local state rather than re-fetching a session.
  const [messages, setMessages] = useState<
    Array<{ id: string; role: string; content: string; confidence?: number; missingKnowledge?: boolean }>
  >([]);

  const createSession = useMutation({
    mutationFn: async () => {
      if (!sandboxVersion) throw new Error('No sandbox version to test');
      const res = await api.post(
        `/super-admin/enterprise-ai-intelligence/businesses/${businessId}/playground/sessions`,
        { versionId: sandboxVersion.id, label: 'Super Admin sandbox' }
      );
      return extractData<{ id: string }>(res);
    },
    onSuccess: (data) => {
      setSessionId(data.id);
      setMessages([]);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!sessionId) throw new Error('No session');
      const res = await api.post(
        `/super-admin/enterprise-ai-intelligence/businesses/${businessId}/playground/sessions/${sessionId}/messages`,
        { content }
      );
      return extractData<{
        id: string;
        content: string;
        confidence?: number;
        hallucinationRisk?: number;
        missingKnowledge?: boolean;
      }>(res);
    },
    onSuccess: (reply, content) => {
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: 'USER', content },
        {
          id: reply.id,
          role: 'ASSISTANT',
          content: reply.content,
          confidence: reply.confidence,
          missingKnowledge: reply.missingKnowledge,
        },
      ]);
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['ai-workspace', 'sandbox', businessId] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!sandboxVersion) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4" />
            Sandbox
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No sandbox version available. Run a training job — successful training automatically enters the sandbox for
            isolated validation before any deployment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="h-4 w-4" />
            Sandbox Testing
            <Badge variant="outline">v{sandboxVersion.versionNumber}</Badge>
          </CardTitle>
          <CardDescription>Isolated environment. Responses never reach live customers.</CardDescription>
        </div>
        {!sessionId && (
          <Button size="sm" onClick={() => createSession.mutate()} disabled={createSession.isPending}>
            Start Session
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-96 space-y-3 overflow-y-auto rounded-md border p-4">
          {!sessionId && (
            <p className="text-sm text-muted-foreground">
              Start a sandbox session to ask questions, measure confidence, and detect knowledge gaps.
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg p-3 text-sm ${
                msg.role === 'USER' ? 'ml-8 bg-primary/10' : 'mr-8 bg-muted'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.role === 'ASSISTANT' && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {msg.confidence != null && <span>Confidence: {Math.round(msg.confidence * 100)}%</span>}
                  {msg.missingKnowledge && <Badge variant="destructive">Knowledge gap</Badge>}
                </div>
              )}
            </div>
          ))}
        </div>
        {sessionId && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (message.trim()) sendMessage.mutate(message.trim());
            }}
          >
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask a test question…"
              disabled={sendMessage.isPending}
            />
            <Button type="submit" disabled={sendMessage.isPending || !message.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function ProductionSection({
  businessId,
  productionVersion,
}: {
  businessId: string;
  productionVersion?: WorkspaceVersion;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Rocket className="h-4 w-4" />
            Live Production Version
          </CardTitle>
        </CardHeader>
        <CardContent>
          {productionVersion ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatTile label="Version" value={`v${productionVersion.versionNumber}`} />
              <StatTile label="Readiness" value={`${Math.round(productionVersion.readinessScore ?? 0)}%`} />
              <StatTile label="Live Since" value={fmtDay(productionVersion.createdAt)} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No production version live yet. Publish an approved sandbox version to go live.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Reuses the deployment request/approval panel scoped to this business */}
      <DeploymentPanel businessId={businessId} readOnly />
    </div>
  );
}

function AnalyticsSection({
  query,
}: {
  query: ReturnType<typeof useQuery<WorkspaceAnalytics>>;
}) {
  if (query.isLoading) return <LoadingState rows={4} />;
  if (query.isError || !query.data) {
    return <ErrorState message="Unable to load analytics." onRetry={() => query.refetch()} />;
  }
  const a = query.data;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="AI Accuracy" value={`${a.conversations.aiResolutionRate}%`} hint="AI resolution rate (30d)" icon={Gauge} />
        <StatTile label="AI Confidence" value={`${Math.round(a.quality.confidenceScore)}%`} icon={Sparkles} />
        <StatTile label="Knowledge Coverage" value={`${Math.round(a.knowledge.knowledgeScore)}%`} icon={Database} />
        <StatTile label="AI Readiness" value={`${Math.round(a.quality.aiReadinessScore)}%`} icon={Brain} />
        <StatTile label="Human Handover" value={`${a.conversations.humanHandoverRate}%`} icon={Activity} />
        <StatTile label="Failed Questions" value={formatNumber(a.quality.failedQuestions)} icon={Info} />
        <StatTile label="Retraining Frequency" value={`${a.training.retrainingFrequency}/30d`} icon={History} />
        <StatTile label="Open Insights" value={formatNumber(a.knowledge.openInsights)} icon={Lightbulb} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Conversations (30d)" value={formatNumber(a.conversations.total)} />
        <StatTile label="AI Messages" value={formatNumber(a.messages.ai)} />
        <StatTile label="Token Usage (est.)" value={formatNumber(a.usage.estimatedTokens)} />
        <StatTile label="Embedding Usage" value={formatNumber(a.usage.embeddingUsage)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Knowledge Growth &amp; Freshness</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <InfoRow label="Documents" value={formatNumber(a.knowledge.documentCount)} />
          <InfoRow label="Embeddings" value={formatNumber(a.knowledge.embeddingCount)} />
          <InfoRow label="Last Trained" value={fmtDate(a.training.lastTrainedAt)} />
        </CardContent>
      </Card>
    </div>
  );
}

const SEVERITY_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
};

function InsightsSection({ insights }: { insights: WorkspaceInsight[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4" />
          AI Recommendations
        </CardTitle>
        <CardDescription>Automatically generated after each training run.</CardDescription>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open insights. Knowledge is in good shape.</p>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => (
              <div key={insight.id} className="flex items-start gap-3 rounded-lg border p-3">
                <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{insight.title}</p>
                    <Badge variant={SEVERITY_VARIANT[insight.severity] ?? 'secondary'}>{insight.severity}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AiLogsSection({
  detail,
  query,
}: {
  detail: BusinessWorkspaceDetail;
  query: ReturnType<typeof useQuery<AuditLogRecord[]>>;
}) {
  const logs = query.data ?? [];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="h-4 w-4" />
            Audit Trail
          </CardTitle>
          <CardDescription>
            Training, embeddings, deployments, approvals, rollbacks and failures — timestamped per business.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <LoadingState rows={4} />
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries yet.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const actor = log.user
                  ? `${log.user.firstName} ${log.user.lastName}`
                  : log.trainer
                    ? `${log.trainer.firstName} ${log.trainer.lastName}`
                    : 'System';
                return (
                  <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{log.action}</Badge>
                        {log.version && <span className="text-xs text-muted-foreground">v{log.version.versionNumber}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {actor}
                        {log.deviceLabel && ` · ${log.deviceLabel}`}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{fmtDate(log.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Training Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {detail.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions recorded.</p>
          ) : (
            <div className="space-y-2">
              {detail.sessions.slice(0, 10).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                  <div>
                    <span className="font-medium">{s.trainingType}</span>
                    <p className="text-xs text-muted-foreground">{fmtDate(s.startedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {s.qualityScore != null && <span>Q {Math.round(s.qualityScore)}%</span>}
                    <Badge variant={s.status === 'COMPLETED' ? 'default' : s.status === 'FAILED' ? 'destructive' : 'secondary'}>
                      {s.status}
                    </Badge>
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

function DeploymentHistorySection({ deployments }: { deployments: DeploymentRecord[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Deployment History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {deployments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deployments recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {deployments.map((d) => {
              const requester = d.requestedByUser
                ? `${d.requestedByUser.firstName} ${d.requestedByUser.lastName}`
                : d.requestedByTrainer
                  ? `${d.requestedByTrainer.firstName} ${d.requestedByTrainer.lastName}`
                  : '—';
              const approver = d.approvedByUser
                ? `${d.approvedByUser.firstName} ${d.approvedByUser.lastName}`
                : '—';
              return (
                <div key={d.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Version {d.version?.versionNumber ?? '—'}</span>
                      <Badge
                        variant={
                          d.status === 'DEPLOYED'
                            ? 'default'
                            : d.status === 'REJECTED'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {d.status}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {fmtDate(d.deployedAt ?? d.requestedAt)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
                    <span>Trainer: {requester}</span>
                    <span>Approved by: {approver}</span>
                    <span>Knowledge: {d.knowledgeScore != null ? `${Math.round(d.knowledgeScore)}%` : '—'}</span>
                    <span>Confidence: {d.confidenceScore != null ? `${Math.round(d.confidenceScore)}%` : '—'}</span>
                  </div>
                  {d.deploymentSummary && (
                    <p className="mt-2 text-sm">{d.deploymentSummary}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SettingsSection({ detail }: { detail: BusinessWorkspaceDetail }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" />
            AI Configuration
          </CardTitle>
          <CardDescription>Model and behavior settings applied to this business's AI.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-x-8 sm:grid-cols-2">
          <InfoRow label="Model Provider" value={detail.currentAiProvider} />
          <InfoRow label="Embedding Model" value={detail.aiVersion} />
          <InfoRow label="Active Version" value={detail.knowledgeVersion ? `v${detail.knowledgeVersion}` : '—'} />
          <InfoRow label="Deployment Status" value={detail.deploymentStatus} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Guardrails</CardTitle>
          <CardDescription>Mandatory rules enforced across every response.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            No hallucination — answers only from indexed business knowledge.
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            No external knowledge or assumptions.
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Business isolation — this workspace never reads another business's data.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
