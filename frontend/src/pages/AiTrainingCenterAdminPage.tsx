import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Bot,
  Building2,
  Layers,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import type { TrainingBusinessCard, TrainingOperation, TrainingVerificationRequest } from '@/lib/ai-training-center-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/utils';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { TrainingOtpDialog } from '@/components/ai-training/TrainingOtpDialog';
import { toast } from 'sonner';

export function AiTrainingCenterAdminPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otpOpen, setOtpOpen] = useState(false);
  const [verification, setVerification] = useState<TrainingVerificationRequest | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ai-training-center', 'businesses', search],
    queryFn: async () => {
      const res = await api.get('/super-admin/ai-training-center/businesses', {
        params: { limit: 100, search: search || undefined },
      });
      return extractData<TrainingBusinessCard[]>(res);
    },
    refetchInterval: 15_000,
  });

  const requestOperation = useMutation({
    mutationFn: async (params: {
      operation: TrainingOperation;
      businessIds: string[];
      payload?: Record<string, unknown>;
    }) => {
      const res = await api.post('/super-admin/ai-training-center/verify/request', params);
      return extractData<TrainingVerificationRequest>(res);
    },
    onSuccess: (result) => {
      setVerification(result);
      setOtpOpen(true);
      toast.message('Verification code sent to your email');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const previewBusiness = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/super-admin/ai-training-center/preview/${id}`);
      return extractData(res);
    },
    onSuccess: (result) => {
      const preview = (result as { preview?: { documents?: number; estimatedCost?: number } }).preview;
      toast.success(
        `Preview: ${preview?.documents ?? 0} docs · est. $${(preview?.estimatedCost ?? 0).toFixed(4)}`
      );
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const businesses = data ?? [];
  const allSelected = useMemo(
    () => businesses.length > 0 && businesses.every((b) => selected.has(b.businessId)),
    [businesses, selected]
  );

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(businesses.map((b) => b.businessId)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const startOperation = (operation: TrainingOperation, businessIds?: string[]) => {
    const ids = businessIds ?? [...selected];
    if (!ids.length && operation !== 'TRAIN_ALL') {
      toast.error('Select at least one business');
      return;
    }
    requestOperation.mutate({ operation, businessIds: ids });
  };

  if (isError) {
    return <ErrorState message="Unable to load AI Training Center." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BookOpen className="h-6 w-6 text-accent" />
            Enterprise AI Training Center
          </h1>
          <p className="text-muted-foreground">
            Manage knowledge, embeddings, and training for every business — OTP secured
          </p>
        </div>
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search businesses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Training Operations
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => startOperation('TRAIN_ONE', selected.size ? [[...selected][0]!] : undefined)}>
            Train One
          </Button>
          <Button size="sm" variant="secondary" onClick={() => startOperation('RETRAIN_ONE', selected.size ? [[...selected][0]!] : undefined)}>
            Retrain One
          </Button>
          <Button size="sm" variant="secondary" onClick={() => startOperation('TRAIN_MULTIPLE')} disabled={!selected.size}>
            Train Selected ({selected.size})
          </Button>
          <Button size="sm" variant="outline" onClick={() => startOperation('TRAIN_ALL')}>
            Train All
          </Button>
          <Button size="sm" variant="outline" onClick={() => startOperation('REBUILD_EMBEDDINGS', selected.size ? [[...selected][0]!] : undefined)}>
            Rebuild Embeddings
          </Button>
          <Button size="sm" variant="outline" onClick={() => startOperation('REINDEX', selected.size ? [[...selected][0]!] : undefined)}>
            Reindex
          </Button>
          <Button size="sm" variant="outline" onClick={() => startOperation('VALIDATE', selected.size ? [[...selected][0]!] : undefined)}>
            Validate
          </Button>
          <Button size="sm" variant="outline" onClick={() => startOperation('OPTIMIZE', selected.size ? [[...selected][0]!] : undefined)}>
            Optimize
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          id="select-all"
          className="h-4 w-4 rounded border"
        />
        <label htmlFor="select-all" className="text-muted-foreground">
          Select all businesses ({businesses.length})
        </label>
      </div>

      {isLoading ? (
        <LoadingState rows={6} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {businesses.map((business) => (
            <Card key={business.businessId} className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(business.businessId)}
                    onChange={() => toggleOne(business.businessId)}
                    className="mt-1 h-4 w-4 rounded border"
                  />
                  <div className="flex flex-1 items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-white">
                        {business.logoUrl ? (
                          <img src={business.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <Building2 className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <Link
                          to={`/admin/ai-training/${business.businessId}`}
                          className="font-semibold hover:underline"
                        >
                          {business.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{business.industry}</p>
                        <p className="text-xs text-muted-foreground">ID: {business.businessId.slice(0, 8)}…</p>
                      </div>
                    </div>
                    <Badge variant={business.trainingStatus === 'IN_PROGRESS' ? 'default' : 'secondary'}>
                      {business.trainingStatus}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-muted-foreground">KB Size</p>
                    <p className="font-semibold">{formatNumber(business.knowledgeBaseSize)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Embeddings</p>
                    <p className="font-semibold">{formatNumber(business.embeddingsCount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Documents</p>
                    <p className="font-semibold">{business.documents}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">FAQs</p>
                    <p className="font-semibold">{business.faqs}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Products</p>
                    <p className="font-semibold">{business.products}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Services</p>
                    <p className="font-semibold">{business.services}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Sparkles className="h-3 w-3" />
                    Health: {Math.round(business.knowledgeHealth)}%
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Layers className="h-3 w-3" />
                    v{business.knowledgeVersion ?? '—'}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Bot className="h-3 w-3" />
                    {business.currentAiProvider}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Zap className="h-3 w-3" />
                    {business.embeddingStatus}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>
                    Last train:{' '}
                    {business.lastTraining ? new Date(business.lastTraining).toLocaleDateString() : '—'}
                  </span>
                  <span>${business.estimatedTrainingCost.toFixed(4)} est.</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => startOperation('TRAIN_ONE', [business.businessId])}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Train
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => previewBusiness.mutate(business.businessId)}
                    disabled={previewBusiness.isPending}
                  >
                    Preview
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TrainingOtpDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        verification={verification}
        onVerified={() => {
          queryClient.invalidateQueries({ queryKey: ['ai-training-center'] });
        }}
      />
    </div>
  );
}
