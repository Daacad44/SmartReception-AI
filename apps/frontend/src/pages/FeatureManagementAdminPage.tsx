import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Archive,
  FlaskConical,
  Layers,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
} from 'lucide-react';
import api, { extractData, getErrorMessage } from '@/lib/api';
import type {
  FeatureAuditLog,
  FeatureManagementStats,
  FeatureVerificationRequest,
  PlatformFeature,
  PlatformFeatureStatus,
} from '@/lib/feature-management-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeatureOtpDialog } from '@/components/feature-management/FeatureOtpDialog';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/utils';

const STATUS_VARIANT: Record<string, 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  DISABLED: 'secondary',
  ENABLED: 'success',
  HIDDEN: 'outline',
  INTERNAL: 'outline',
  BETA: 'warning',
  COMING_SOON: 'warning',
  EXPERIMENTAL: 'warning',
  DEPRECATED: 'destructive',
  ARCHIVED: 'secondary',
};

const ALL_STATUSES: PlatformFeatureStatus[] = [
  'DISABLED',
  'ENABLED',
  'HIDDEN',
  'INTERNAL',
  'BETA',
  'COMING_SOON',
  'EXPERIMENTAL',
  'DEPRECATED',
  'ARCHIVED',
];

interface FeatureListResponse {
  features: PlatformFeature[];
  categories: string[];
}

export function FeatureManagementAdminPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedFeature, setSelectedFeature] = useState<PlatformFeature | null>(null);
  const [targetStatus, setTargetStatus] = useState<PlatformFeatureStatus>('ENABLED');
  const [reason, setReason] = useState('');
  const [otpOpen, setOtpOpen] = useState(false);
  const [verification, setVerification] = useState<FeatureVerificationRequest | null>(null);
  const queryClient = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['feature-management', 'stats'],
    queryFn: async () => {
      const res = await api.get('/super-admin/feature-management/stats');
      return extractData<FeatureManagementStats>(res);
    },
    refetchInterval: 30_000,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['feature-management', 'features', search, category, statusFilter],
    queryFn: async () => {
      const res = await api.get('/super-admin/feature-management/features', {
        params: {
          search: search || undefined,
          category: category !== 'all' ? category : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        },
      });
      return extractData<FeatureListResponse>(res);
    },
    refetchInterval: 30_000,
  });

  const { data: auditLogs } = useQuery({
    queryKey: ['feature-management', 'audit-logs', selectedFeature?.id],
    queryFn: async () => {
      const res = await api.get('/super-admin/feature-management/audit-logs', {
        params: { featureId: selectedFeature?.id, limit: 20 },
      });
      return extractData<FeatureAuditLog[]>(res);
    },
    enabled: !!selectedFeature,
  });

  const requestChange = useMutation({
    mutationFn: async (params: { featureId: string; targetStatus: PlatformFeatureStatus; reason?: string }) => {
      const res = await api.post('/super-admin/feature-management/verify/request', params);
      return extractData<FeatureVerificationRequest>(res);
    },
    onSuccess: (result) => {
      setVerification(result);
      setOtpOpen(true);
      toast.message('Verification code sent to your Super Admin email');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const features = data?.features ?? [];
  const categories = data?.categories ?? [];

  const futureFeatures = useMemo(
    () => features.filter((f) => f.releaseType === 'FUTURE'),
    [features]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, PlatformFeature[]>();
    for (const f of features) {
      if (f.releaseType === 'FUTURE') continue;
      const list = map.get(f.category) ?? [];
      list.push(f);
      map.set(f.category, list);
    }
    return map;
  }, [features]);

  const openChangeDialog = (feature: PlatformFeature, status: PlatformFeatureStatus) => {
    setSelectedFeature(feature);
    setTargetStatus(status);
    setReason('');
  };

  const submitChange = () => {
    if (!selectedFeature) return;
    requestChange.mutate({
      featureId: selectedFeature.id,
      targetStatus,
      reason: reason.trim() || undefined,
    });
  };

  const handleVerified = () => {
    queryClient.invalidateQueries({ queryKey: ['feature-management'] });
    queryClient.invalidateQueries({ queryKey: ['platform-features'] });
    setSelectedFeature(null);
    setReason('');
  };

  if (isError) {
    return <ErrorState message="Failed to load feature registry" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-7 w-7 text-accent" />
            <h1 className="text-2xl font-bold">Feature Management Center</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            Enterprise feature registry. Only Super Admins can activate or deactivate features after OTP
            verification.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Features</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.total ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Enabled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats?.enabled ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Disabled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.disabled ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Future Features</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{stats?.future ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="registry">
        <TabsList>
          <TabsTrigger value="registry">Feature Registry</TabsTrigger>
          <TabsTrigger value="future">
            Future Features
            {futureFeatures.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {futureFeatures.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registry" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search features…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <LoadingState rows={8} />
          ) : (
            Array.from(grouped.entries()).map(([cat, items]) => (
              <Card key={cat}>
                <CardHeader>
                  <CardTitle className="text-base">{cat}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {items.map((feature) => (
                    <FeatureRow
                      key={feature.id}
                      feature={feature}
                      isSelected={selectedFeature?.id === feature.id}
                      onSelect={() => setSelectedFeature(feature)}
                      onEnable={() => openChangeDialog(feature, 'ENABLED')}
                      onDisable={() => openChangeDialog(feature, 'DISABLED')}
                    />
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="future" className="space-y-4">
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Archive className="h-5 w-5" />
                Future Features Marketplace
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Features stored here remain completely inactive — no routing, navigation, API execution, or
                token usage until released by Super Admin with OTP verification.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {futureFeatures.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">No future features registered.</p>
              ) : (
                futureFeatures.map((feature) => (
                  <FeatureRow
                    key={feature.id}
                    feature={feature}
                    isSelected={selectedFeature?.id === feature.id}
                    onSelect={() => setSelectedFeature(feature)}
                    onEnable={() => openChangeDialog(feature, 'ENABLED')}
                    onDisable={() => openChangeDialog(feature, 'DISABLED')}
                    showRelease
                  />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedFeature && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-accent" />
              {selectedFeature.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{selectedFeature.description}</p>

            {selectedFeature.dependencies && selectedFeature.dependencies.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Dependencies</p>
                <div className="flex flex-wrap gap-2">
                  {selectedFeature.dependencies.map((d) => (
                    <Badge
                      key={d.dependsOnFeature.featureKey}
                      variant={d.dependsOnFeature.status === 'ENABLED' ? 'success' : 'warning'}
                    >
                      {d.dependsOnFeature.name} ({d.dependsOnFeature.status})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Target status</p>
                <Select
                  value={targetStatus}
                  onValueChange={(v) => setTargetStatus(v as PlatformFeatureStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Current status</p>
                <Badge variant={STATUS_VARIANT[selectedFeature.status] ?? 'secondary'} className="mt-2">
                  {selectedFeature.status.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Reason (optional)</p>
              <Textarea
                placeholder="Why is this change being made?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={submitChange}
                disabled={requestChange.isPending || targetStatus === selectedFeature.status}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Request OTP Verification
              </Button>
              <Button variant="ghost" onClick={() => setSelectedFeature(null)}>
                Cancel
              </Button>
            </div>

            {auditLogs && auditLogs.length > 0 && (
              <div className="border-t pt-4">
                <p className="mb-3 text-sm font-medium">Audit History</p>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="rounded border px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{log.action.replace(/_/g, ' ')}</span>
                        <span className="text-muted-foreground">{formatRelativeTime(log.createdAt)}</span>
                      </div>
                      {log.previousStatus && log.newStatus && (
                        <p className="text-muted-foreground">
                          {log.previousStatus} → {log.newStatus}
                        </p>
                      )}
                      {log.reason && <p className="text-muted-foreground">{log.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <FeatureOtpDialog
        open={otpOpen}
        onOpenChange={setOtpOpen}
        verification={verification}
        onVerified={handleVerified}
      />
    </div>
  );
}

function FeatureRow({
  feature,
  isSelected,
  onSelect,
  onEnable,
  onDisable,
  showRelease,
}: {
  feature: PlatformFeature;
  isSelected: boolean;
  onSelect: () => void;
  onEnable: () => void;
  onDisable: () => void;
  showRelease?: boolean;
}) {
  const hasUnmetDeps = feature.dependencies?.some((d) => d.dependsOnFeature.status !== 'ENABLED');

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
        isSelected ? 'border-accent bg-accent/5' : ''
      }`}
    >
      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{feature.name}</span>
          <Badge variant={STATUS_VARIANT[feature.status] ?? 'secondary'}>
            {feature.status.replace(/_/g, ' ')}
          </Badge>
          {feature.releaseType !== 'STANDARD' && (
            <Badge variant="outline">{feature.releaseType}</Badge>
          )}
          {feature.blocksAi && (
            <Badge variant="outline" className="gap-1">
              <FlaskConical className="h-3 w-3" /> AI
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{feature.description}</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{feature.featureKey}</p>
        {hasUnmetDeps && (
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            Dependencies not enabled
          </p>
        )}
      </button>
      <div className="flex shrink-0 gap-2">
        {showRelease ? (
          <Button size="sm" onClick={onEnable} disabled={feature.status === 'ENABLED'}>
            <Power className="mr-1 h-4 w-4" />
            Release
          </Button>
        ) : (
          <>
            {feature.status !== 'ENABLED' && (
              <Button size="sm" variant="outline" onClick={onEnable} disabled={!!hasUnmetDeps}>
                <Power className="mr-1 h-4 w-4" />
                Enable
              </Button>
            )}
            {feature.status === 'ENABLED' && feature.featureKey !== 'feature-management' && (
              <Button size="sm" variant="outline" onClick={onDisable}>
                <PowerOff className="mr-1 h-4 w-4" />
                Disable
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
