import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Users,
  Calendar,
  Bot,
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowRight,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useDashboardBundle, useConversations, useWhatsAppStatus, isInitialLoading } from '@/hooks/useApi';
import { formatNumber, formatPercent, formatCurrency, getInitials, formatRelativeTime } from '@/lib/utils';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { QuerySection } from '@/components/QuerySection';

function KpiCard({
  title,
  value,
  growth,
  icon: Icon,
  format = 'number',
}: {
  title: string;
  value: number;
  growth: number;
  icon: React.ElementType;
  format?: 'number' | 'percent' | 'currency';
}) {
  const isPositive = growth >= 0;
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const safeGrowth = Number.isFinite(Number(growth)) ? Number(growth) : 0;
  const formatted =
    format === 'percent' ? `${safeValue}%` : format === 'currency' ? formatCurrency(safeValue) : formatNumber(safeValue);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Icon className="h-5 w-5 text-accent" />
          </div>
          <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-success' : 'text-danger'}`}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {formatPercent(safeGrowth)}
          </div>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold">{formatted}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const statusColors: Record<string, string> = {
  open: 'bg-warning/10 text-warning',
  pending: 'bg-accent/10 text-accent',
  resolved: 'bg-success/10 text-success',
  ai_handling: 'bg-primary/10 text-primary',
};

function hasChartData<T>(data: T[] | undefined, key: keyof T): boolean {
  return Boolean(data?.length && data.some((item) => Number(item[key]) > 0));
}

export function DashboardPage() {
  const {
    data: bundle,
    isPending,
    isFetching,
    isError,
    refetch,
  } = useDashboardBundle();
  const {
    data: conversations,
    isPending: convsPending,
    isFetching: convsFetching,
    isError: convsError,
    refetch: refetchConversations,
  } = useConversations();
  const { data: whatsappStatus } = useWhatsAppStatus();

  const bundleLoading = isInitialLoading(isPending, isFetching, bundle);
  const convsLoading = isInitialLoading(convsPending, convsFetching, conversations);

  const stats = bundle?.stats;
  const revenue = bundle?.revenue;
  const customerGrowth = bundle?.customerGrowth;
  const trends = bundle?.trends;
  const topServices = bundle?.topServices;
  const teamPerf = bundle?.teamPerformance;

  const aiHandlingCount = conversations?.filter((c) => c.status === 'ai_handling').length ?? 0;
  const maxBookings = topServices?.[0]?.bookingCount ?? 1;

  if (isError && !bundle) {
    return (
      <ErrorState
        message="Unable to load dashboard data. Check your API connection."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here&apos;s what&apos;s happening today.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/appointments">
              <Plus className="mr-2 h-4 w-4" />
              New Appointment
            </Link>
          </Button>
          <Button size="sm" className="bg-accent hover:bg-accent/90" asChild>
            <Link to="/conversations">
              <MessageSquare className="mr-2 h-4 w-4" />
              View Inbox
            </Link>
          </Button>
        </div>
      </div>

      {whatsappStatus?.whatsappStatus === 'NOT_CONNECTED' && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              WhatsApp is not connected. Connect your Meta Cloud API to start sending and receiving messages.
            </p>
          </div>
          <Button size="sm" className="shrink-0 bg-accent hover:bg-accent/90" asChild>
            <Link to="/settings?tab=whatsapp">Connect WhatsApp</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {bundleLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <KpiCard title="Total Conversations" value={stats?.totalConversations ?? 0} growth={stats?.conversationGrowth ?? 0} icon={MessageSquare} />
            <KpiCard title="Active Customers" value={stats?.activeCustomers ?? 0} growth={stats?.customerGrowth ?? 0} icon={Users} />
            <KpiCard title="Appointments Today" value={stats?.appointmentsToday ?? 0} growth={stats?.appointmentGrowth ?? 0} icon={Calendar} />
            <KpiCard title="AI Resolution Rate" value={stats?.aiResolutionRate ?? 0} growth={stats?.aiGrowth ?? 0} icon={Bot} format="percent" />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue Overview</CardTitle>
            <CardDescription>Monthly revenue for the past year</CardDescription>
          </CardHeader>
          <CardContent>
            <QuerySection
              isLoading={bundleLoading}
              isError={isError}
              errorMessage="Failed to load revenue data"
              isEmpty={!hasChartData(revenue, 'revenue')}
              emptyMessage="No revenue recorded yet"
              onRetry={() => refetch()}
              skeleton={<Skeleton className="h-[280px] w-full" />}
            >
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenue ?? []}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#651147" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#651147" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6B7280" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v) => [formatCurrency(v ?? 0), 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="#651147" fill="url(#revenueGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </QuerySection>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer Growth</CardTitle>
            <CardDescription>New customers added each month</CardDescription>
          </CardHeader>
          <CardContent>
            <QuerySection
              isLoading={bundleLoading}
              isError={isError}
              errorMessage="Failed to load customer growth"
              isEmpty={!hasChartData(customerGrowth, 'customers')}
              emptyMessage="No new customers yet"
              onRetry={() => refetch()}
              skeleton={<Skeleton className="h-[280px] w-full" />}
            >
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={customerGrowth ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6B7280" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="customers" stroke="#0F172A" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </QuerySection>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Conversation Trends</CardTitle>
            <CardDescription>Daily conversation volume (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <QuerySection
              isLoading={bundleLoading}
              isError={isError}
              errorMessage="Failed to load conversation trends"
              isEmpty={!hasChartData(trends, 'count')}
              emptyMessage="No conversations recorded yet"
              onRetry={() => refetch()}
              skeleton={<Skeleton className="h-[240px] w-full" />}
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trends ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    stroke="#6B7280"
                    tickFormatter={(v) => String(v).slice(5)}
                  />
                  <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" allowDecimals={false} />
                  <Tooltip labelFormatter={(v) => String(v)} />
                  <Bar dataKey="count" fill="#651147" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </QuerySection>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'View Inbox', icon: MessageSquare, to: '/conversations' },
              { label: 'Add Customer', icon: Users, to: '/customers' },
              { label: 'Schedule Appointment', icon: Calendar, to: '/appointments' },
              { label: 'Upload Document', icon: Plus, to: '/knowledge' },
            ].map((action) => (
              <Button key={action.label} variant="outline" className="w-full justify-start" asChild>
                <Link to={action.to}>
                  <action.icon className="mr-2 h-4 w-4" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Top Services</CardTitle>
            <Link to="/appointments" className="text-xs text-accent hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <QuerySection
              isLoading={bundleLoading}
              isError={isError}
              errorMessage="Failed to load services"
              isEmpty={!topServices?.length}
              emptyMessage="No service bookings yet"
              onRetry={() => refetch()}
              skeleton={<Skeleton className="h-32 w-full" />}
            >
              {topServices?.map((service, i) => (
                <div key={service.serviceId} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{service.name}</p>
                    <p className="text-xs text-muted-foreground">{service.bookingCount} bookings</p>
                  </div>
                  <Progress value={maxBookings > 0 ? (service.bookingCount / maxBookings) * 100 : 0} className="h-1.5 w-16" />
                </div>
              ))}
            </QuerySection>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <QuerySection
              isLoading={bundleLoading}
              isError={isError}
              errorMessage="Failed to load team performance"
              isEmpty={!teamPerf?.length}
              emptyMessage="No team activity yet"
              onRetry={() => refetch()}
              skeleton={<Skeleton className="h-32 w-full" />}
            >
              {teamPerf?.map((member) => (
                <div key={member.userId} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-navy text-white text-xs">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.conversationCount} conversations
                    </p>
                  </div>
                  <Badge variant="success" className="text-[10px]">
                    {member.resolutionRate}%
                  </Badge>
                </div>
              ))}
            </QuerySection>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
                <Zap className="h-4 w-4 text-success" />
              </div>
              <div>
                <CardTitle className="text-base">AI Assistant</CardTitle>
                <CardDescription>Status: Active</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Resolution Rate</span>
                <span className="font-medium">{stats?.aiResolutionRate ?? 0}%</span>
              </div>
              <Progress value={stats?.aiResolutionRate ?? 0} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Conversations</span>
                <span className="font-medium">{stats?.totalConversations ?? 0}</span>
              </div>
              <Progress value={Math.min((stats?.totalConversations ?? 0) * 10, 100)} className="h-2" />
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">
                AI is actively handling {aiHandlingCount} conversation{aiHandlingCount !== 1 ? 's' : ''}.
                Resolution rate: {stats?.aiResolutionRate ?? 0}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent Conversations</CardTitle>
            <CardDescription>Latest customer interactions</CardDescription>
          </div>
          <Link to="/conversations">
            <Button variant="ghost" size="sm">
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <QuerySection
            isLoading={convsLoading}
            isError={convsError}
            errorMessage="Failed to load conversations"
            isEmpty={!conversations?.length}
            emptyMessage="No conversations yet"
            onRetry={() => refetchConversations()}
            skeleton={<Skeleton className="h-48 w-full" />}
          >
            <div className="space-y-3">
              {conversations?.slice(0, 5).map((conv) => (
                <div key={conv.id} className="flex items-center gap-4 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-accent/10 text-accent text-sm">
                      {getInitials(conv.customerName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{conv.customerName}</p>
                      <Badge className={`text-[10px] ${statusColors[conv.status]}`}>
                        {conv.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(conv.lastMessageAt)}</p>
                    {conv.unreadCount > 0 && (
                      <Badge className="mt-1 bg-accent text-white text-[10px]">{conv.unreadCount}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </QuerySection>
        </CardContent>
      </Card>
    </div>
  );
}
