import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { MessageSquare, Clock, Star, Bot } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAnalytics, isInitialLoading } from '@/hooks/useApi';
import { formatNumber } from '@/lib/utils';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { QuerySection } from '@/components/QuerySection';

const COLORS = ['#651147', '#0F172A', '#10B981', '#F59E0B', '#6B7280'];

function hasActivity(data: Array<{ messages?: number; count?: number }> | undefined): boolean {
  return Boolean(data?.some((d) => (d.messages ?? d.count ?? 0) > 0));
}

export function AnalyticsPage() {
  const { data: analytics, isPending, isFetching, isError, refetch } = useAnalytics();
  const isLoading = isInitialLoading(isPending, isFetching, analytics);

  if (isError && !analytics) {
    return <ErrorState message="Unable to load analytics data." onRetry={() => refetch()} />;
  }

  const channelData =
    analytics?.channelBreakdown?.filter((c) => c.count > 0) ?? [];
  const topicData = analytics?.topTopics?.filter((t) => t.count > 0) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Insights into your business performance and AI metrics</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : [
              { label: 'Total Messages', value: formatNumber(analytics?.totalMessages ?? 0), icon: MessageSquare },
              { label: 'Avg Response Time', value: analytics?.avgResponseTime ?? '—', icon: Clock },
              { label: 'Satisfaction Score', value: `${analytics?.satisfactionScore ?? 0}/5`, icon: Star },
              { label: 'AI Handled', value: `${analytics?.aiHandledPercent ?? 0}%`, icon: Bot },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                      <stat.icon className="h-5 w-5 text-accent" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hourly Activity</CardTitle>
            <CardDescription>Message volume throughout the day</CardDescription>
          </CardHeader>
          <CardContent>
            <QuerySection
              isLoading={isLoading}
              isError={isError}
              errorMessage="Failed to load hourly activity"
              isEmpty={!hasActivity(analytics?.hourlyActivity)}
              emptyMessage="No message activity recorded yet"
              onRetry={() => refetch()}
              skeleton={<Skeleton className="h-[280px] w-full" />}
            >
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics?.hourlyActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} stroke="#6B7280" interval={3} />
                  <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="messages" fill="#651147" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </QuerySection>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Channel Breakdown</CardTitle>
            <CardDescription>Messages by communication channel</CardDescription>
          </CardHeader>
          <CardContent>
            <QuerySection
              isLoading={isLoading}
              isError={isError}
              errorMessage="Failed to load channel breakdown"
              isEmpty={!channelData.length}
              emptyMessage="No channel data yet"
              onRetry={() => refetch()}
              skeleton={<Skeleton className="h-[280px] w-full" />}
            >
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={channelData}
                    dataKey="count"
                    nameKey="channel"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ channel, percent }) => `${channel} ${(percent * 100).toFixed(0)}%`}
                  >
                    {channelData.map((_entry, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </QuerySection>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Conversation Topics</CardTitle>
          <CardDescription>Most discussed topics by customers</CardDescription>
        </CardHeader>
        <CardContent>
          <QuerySection
            isLoading={isLoading}
            isError={isError}
            errorMessage="Failed to load topics"
            isEmpty={!topicData.length}
            emptyMessage="No conversation topics detected yet"
            onRetry={() => refetch()}
            skeleton={<Skeleton className="h-[300px] w-full" />}
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={topicData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#6B7280" allowDecimals={false} />
                <YAxis dataKey="topic" type="category" tick={{ fontSize: 12 }} stroke="#6B7280" width={120} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#0F172A" strokeWidth={2} dot={{ fill: '#651147' }} />
              </LineChart>
            </ResponsiveContainer>
          </QuerySection>
        </CardContent>
      </Card>
    </div>
  );
}
