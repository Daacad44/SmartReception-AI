import { BarChart3, Bot, Coins, Sparkles } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api, { extractData } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalytics } from '@/hooks/useApi';

interface UnifiedDashboard {
  metrics: {
    customers: number;
    conversations: number;
    totalMessages: number;
    aiHandledPercent: number;
  };
  tokens: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    monthly: number;
  };
  costs: {
    ai: number;
    whatsapp: number;
    operating: number;
  };
  financial: {
    revenue: number;
    profit: number;
    mrr: number;
  };
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="rounded-lg bg-accent/10 p-2">
          <Icon className="h-5 w-5 text-accent" />
        </div>
      </CardContent>
    </Card>
  );
}

export function BusinessIntelligencePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['business-intelligence-dashboard'],
    queryFn: async () =>
      extractData<UnifiedDashboard>(await api.get('/business-intelligence/dashboard')),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  const { data: analytics } = useAnalytics();

  if (isError && !data) {
    return <ErrorState message="Unable to load Business Intelligence." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Business Intelligence</h1>
        <p className="text-muted-foreground">
          Unified analytics, AI usage, token consumption, and financial intelligence
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <MetricCard title="Customers" value={formatNumber(data?.metrics.customers ?? 0)} icon={BarChart3} />
            <MetricCard title="Conversations" value={formatNumber(data?.metrics.conversations ?? 0)} icon={Bot} />
            <MetricCard
              title="Total Messages"
              value={formatNumber(data?.metrics.totalMessages ?? analytics?.totalMessages ?? 0)}
              subtitle={`${data?.metrics.aiHandledPercent ?? analytics?.aiHandledPercent ?? 0}% AI handled`}
              icon={Sparkles}
            />
            <MetricCard
              title="AI Cost (Month)"
              value={`$${(data?.costs.ai ?? 0).toFixed(2)}`}
              subtitle={`Revenue: $${(data?.financial.revenue ?? 0).toFixed(2)}`}
              icon={Coins}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Token Breakdown</CardTitle>
            <CardDescription>Input vs output token consumption</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground">Input</p><p className="text-xl font-bold">{formatNumber(data?.tokens.inputTokens ?? 0)}</p></div>
            <div><p className="text-muted-foreground">Output</p><p className="text-xl font-bold">{formatNumber(data?.tokens.outputTokens ?? 0)}</p></div>
            <div><p className="text-muted-foreground">Monthly</p><p className="text-xl font-bold">{formatNumber(data?.tokens.monthly ?? 0)}</p></div>
            <div><p className="text-muted-foreground">Total</p><p className="text-xl font-bold">{formatNumber(data?.tokens.totalTokens ?? 0)}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Financial & Operating Costs</CardTitle>
            <CardDescription>Revenue, profit, and operating expenses</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground">MRR</p><p className="text-xl font-bold">${(data?.financial.mrr ?? 0).toFixed(2)}</p></div>
            <div><p className="text-muted-foreground">Profit</p><p className="text-xl font-bold">${(data?.financial.profit ?? 0).toFixed(2)}</p></div>
            <div><p className="text-muted-foreground">WhatsApp Cost</p><p className="text-xl font-bold">${(data?.costs.whatsapp ?? 0).toFixed(2)}</p></div>
            <div><p className="text-muted-foreground">Operating</p><p className="text-xl font-bold">${(data?.costs.operating ?? 0).toFixed(2)}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business Performance</CardTitle>
          <CardDescription>Conversation and satisfaction metrics from unified analytics</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
          <div><p className="text-muted-foreground">Avg Response Time</p><p className="text-lg font-semibold">{analytics?.avgResponseTime ?? '—'}</p></div>
          <div><p className="text-muted-foreground">Satisfaction</p><p className="text-lg font-semibold">{analytics?.satisfactionScore ?? 0}/5</p></div>
          <div><p className="text-muted-foreground">AI Handled</p><p className="text-lg font-semibold">{analytics?.aiHandledPercent ?? 0}%</p></div>
        </CardContent>
      </Card>
    </div>
  );
}
