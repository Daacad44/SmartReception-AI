import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Bot, Coins, Gauge, Layers, Sparkles, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api, { extractData } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';

interface AiAnalyticsDashboard {
  usage: {
    today: { totalRequests: number; totalTokens: number; estimatedCostUsd: number };
    thisWeek: { totalRequests: number; totalTokens: number; estimatedCostUsd: number };
    thisMonth: { totalRequests: number; totalTokens: number; estimatedCostUsd: number; tokenSavingsPercent: number };
    lifetime: { totalRequests: number; totalTokens: number; estimatedCostUsd: number };
    predictedEndOfMonthCost: number;
  };
  performance: {
    avgResponseTimeMs: number;
    tokenSavingsPercent: number;
    searchSuccessRate: number;
    fallbackRate: number;
    avgTokensPerConversation: number;
  };
  charts: {
    dailyTokens: Array<{ date: string; tokens: number; cost: number }>;
    providerUsage: Record<string, number>;
    peakHours: Array<{ hour: number; count: number }>;
    topCategories: Array<{ category: string | null; count: number }>;
  };
  knowledge: { chunkCount: number; avgRetrievedChunks: number };
  topCustomers: Array<{
    customerId: string;
    conversationCount: number;
    totalTokens: number;
    estimatedCostUsd: number;
  }>;
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

export function AiAnalyticsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ai-analytics-dashboard'],
    queryFn: async () =>
      extractData<AiAnalyticsDashboard>(await api.get('/ai-analytics/dashboard')),
  });

  if (isError && !data) {
    return <ErrorState message="Unable to load AI analytics." onRetry={() => refetch()} />;
  }

  const providerData = Object.entries(data?.charts.providerUsage ?? {}).map(([name, value]) => ({
    name,
    value,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Analytics</h1>
        <p className="text-muted-foreground">
          Token usage, RAG performance, and cost intelligence for your AI receptionist
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <MetricCard
              title="AI Requests (Today)"
              value={formatNumber(data?.usage.today.totalRequests ?? 0)}
              subtitle={`${formatNumber(data?.usage.today.totalTokens ?? 0)} tokens`}
              icon={Bot}
            />
            <MetricCard
              title="Cost (This Month)"
              value={`$${(data?.usage.thisMonth.estimatedCostUsd ?? 0).toFixed(4)}`}
              subtitle={`Predicted EOM: $${(data?.usage.predictedEndOfMonthCost ?? 0).toFixed(2)}`}
              icon={Coins}
            />
            <MetricCard
              title="Token Savings (RAG)"
              value={`${(data?.performance.tokenSavingsPercent ?? 0).toFixed(1)}%`}
              subtitle="vs full knowledge base injection"
              icon={Sparkles}
            />
            <MetricCard
              title="Avg Response Time"
              value={`${data?.performance.avgResponseTimeMs ?? 0}ms`}
              subtitle={`${(data?.performance.searchSuccessRate ?? 0).toFixed(0)}% retrieval success`}
              icon={Gauge}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Token Usage</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.charts.dailyTokens ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString()} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="tokens" stroke="#D97706" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Provider Usage</CardTitle>
            <CardDescription>Requests by provider this month</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={providerData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#651147" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" /> Knowledge Chunks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(data?.knowledge.chunkCount ?? 0)}</p>
            <p className="text-sm text-muted-foreground">
              Avg retrieved: {(data?.knowledge.avgRetrievedChunks ?? 0).toFixed(1)} chunks/request
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4" /> Compression
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{(data?.performance.fallbackRate ?? 0).toFixed(1)}%</p>
            <p className="text-sm text-muted-foreground">Fallback rate when retrieval misses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.charts.topCategories ?? []).slice(0, 5).map((item) => (
              <div key={item.category ?? 'general'} className="flex justify-between text-sm">
                <span>{item.category ?? 'general'}</span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
