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
  const pendingApproval = data?.pendingApprovals?.find(
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
            <h1 className="text-2xl font-bold">AI Training</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            The single source where your AI learns about your business — profile, documents, FAQs,
            and sync status.
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
              Documents & FAQs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
