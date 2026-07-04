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
import { Bot, Coins, Gauge, Layers, Sparkles, Users, Zap } from 'lucide-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import api, { extractData } from '@/lib/api';
import type { AiAnalyticsDashboard } from '@/lib/ai-analytics-types';
import { formatNumber } from '@/lib/utils';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
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
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });

  if (isError && !data) {
    return <ErrorState message="Unable to load AI analytics." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Analytics</h1>
        <p className="text-muted-foreground">
          Real-time token usage, RAG performance, and cost intelligence from your database
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <MetricCard
              title="Tokens (Today)"
              value={formatNumber(data?.usage.today.totalTokens ?? 0)}
              subtitle={`$${(data?.usage.today.estimatedCostUsd ?? 0).toFixed(4)} estimated cost`}
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
              subtitle={`${formatNumber(data?.tokenIntelligence?.lifetimeSavings ?? 0)} tokens saved`}
              icon={Sparkles}
            />
            <MetricCard
              title="Avg Response Time"
              value={`${data?.performance.avgResponseTimeMs ?? 0}ms`}
              subtitle={`${(data?.performance.automationSuccessRate ?? 0).toFixed(0)}% automation success`}
              icon={Gauge}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading && !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <MetricCard
              title="Customers"
              value={formatNumber(data?.customers.total ?? 0)}
              subtitle={`${data?.customers.active ?? 0} active · ${data?.customers.returning ?? 0} returning`}
              icon={Users}
            />
            <MetricCard
              title="Conversations"
              value={formatNumber(data?.conversations.total ?? 0)}
              subtitle={`${formatNumber(data?.conversations.totalAiMessages ?? 0)} AI messages`}
              icon={Bot}
            />
            <MetricCard
              title="Lifetime Tokens"
              value={formatNumber(data?.usage.lifetime.totalTokens ?? 0)}
              subtitle={`${formatNumber(data?.usage.thisWeek.totalTokens ?? 0)} this week`}
              icon={Zap}
            />
            <MetricCard
              title="Lifetime Cost"
              value={`$${(data?.usage.lifetime.estimatedCostUsd ?? 0).toFixed(4)}`}
              subtitle={`$${(data?.costIntelligence?.costPerConversation ?? 0).toFixed(4)} per conversation`}
              icon={Coins}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Token Usage</CardTitle>
            <CardDescription>Last 30 days from database records</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading && !data ? (
              <Skeleton className="h-full w-full" />
            ) : (data?.charts.dailyTokens ?? []).length === 0 ? (
              <ChartEmptyState message="No token usage recorded yet." />
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
            <CardDescription>Tokens by provider this month</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {isLoading && !data ? (
              <Skeleton className="h-full w-full" />
            ) : (data?.charts.providerUsage ?? []).length === 0 ? (
              <ChartEmptyState message="No provider usage this month." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.charts.providerUsage ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="provider" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="tokens" fill="#651147" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer Growth</CardTitle>
            <CardDescription>New customers over 90 days</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading && !data ? (
              <Skeleton className="h-full w-full" />
            ) : (data?.charts.customerGrowth ?? []).length === 0 ? (
              <ChartEmptyState message="No customer growth data yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.charts.customerGrowth ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString()} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#651147" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Peak Usage Hours</CardTitle>
            <CardDescription>Message volume by hour</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {isLoading && !data ? (
              <Skeleton className="h-full w-full" />
            ) : (data?.charts.peakHours ?? []).length === 0 ? (
              <ChartEmptyState message="No message activity recorded yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.charts.peakHours ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#D97706" radius={[4, 4, 0, 0]} />
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
              <Layers className="h-4 w-4" /> Knowledge Base
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatNumber(data?.knowledge.chunkCount ?? 0)}</p>
            <p className="text-sm text-muted-foreground">
              Status: {data?.knowledge.trainingStatus ?? 'NOT_STARTED'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4" /> Token Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Input</span>
              <span>{formatNumber(data?.tokenIntelligence?.inputTokens ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Output</span>
              <span>{formatNumber(data?.tokenIntelligence?.outputTokens ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Knowledge</span>
              <span>{formatNumber(data?.tokenIntelligence?.knowledgeTokens ?? 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Retrieved Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.knowledge.topDocuments ?? []).slice(0, 5).map((doc) => (
              <div key={doc.id} className="flex justify-between text-sm">
                <span className="truncate pr-2">{doc.title}</span>
                <span className="font-medium">{doc.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
