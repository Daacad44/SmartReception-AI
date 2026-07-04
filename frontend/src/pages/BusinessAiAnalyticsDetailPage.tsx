import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ArrowLeft } from 'lucide-react';
import api, { extractData } from '@/lib/api';
import type { AiBusinessDetailAnalytics } from '@/lib/ai-analytics-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';

export function BusinessAiAnalyticsDetailPage() {
  const { businessId } = useParams<{ businessId: string }>();
  const [customerFilter, setCustomerFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['super-admin', 'ai-analytics', 'business', businessId, providerFilter],
    queryFn: async () =>
      extractData<AiBusinessDetailAnalytics>(
        await api.get(`/super-admin/ai-analytics/businesses/${businessId}`, {
          params: providerFilter ? { provider: providerFilter } : undefined,
        })
      ),
    enabled: Boolean(businessId),
    refetchInterval: 15_000,
  });

  const filteredCustomers = useMemo(() => {
    const list = data?.customers ?? [];
    if (!customerFilter.trim()) return list;
    const q = customerFilter.toLowerCase();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.customerId.toLowerCase().includes(q) ||
        c.phone?.includes(q)
    );
  }, [data?.customers, customerFilter]);

  const filteredConversations = useMemo(() => {
    const list = data?.conversations ?? [];
    if (!customerFilter.trim()) return list;
    const q = customerFilter.toLowerCase();
    return list.filter(
      (c) =>
        c.customerName.toLowerCase().includes(q) ||
        c.conversationId.toLowerCase().includes(q)
    );
  }, [data?.conversations, customerFilter]);

  if (isError) {
    return <ErrorState message="Unable to load business analytics." onRetry={() => refetch()} />;
  }

  if (isLoading || !data) {
    return (
      <div className="p-6">
        <LoadingState rows={8} />
      </div>
    );
  }

  const charts = data.charts ?? { dailyTokens: [], providerUsage: [] };

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/admin/ai-analytics">
              <ArrowLeft className="mr-1 h-4 w-4" />
              All Businesses
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Business AI Analytics</h1>
          <p className="text-muted-foreground">
            Business ID: {businessId} — live metrics from database records
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="w-48"
            placeholder="Filter customers..."
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
          />
          <Input
            className="w-36"
            placeholder="Provider"
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Lifetime Tokens</p>
            <p className="text-2xl font-bold">{formatNumber(data.usage.lifetime.totalTokens)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Lifetime Cost</p>
            <p className="text-2xl font-bold">${data.usage.lifetime.estimatedCostUsd.toFixed(4)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Customers</p>
            <p className="text-2xl font-bold">{formatNumber(data.customers.length)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Token Savings</p>
            <p className="text-2xl font-bold">{data.performance.tokenSavingsPercent.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Tokens</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.dailyTokens}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString()} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="tokens" stroke="#D97706" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Provider Usage</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.providerUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="provider" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="tokens" fill="#651147" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer Growth</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.customerGrowth ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString()} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#651147" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Conversation Growth</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.conversationGrowth ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString()} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#D97706" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>{filteredCustomers.length} customers with AI analytics</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Name</th>
                <th className="pb-2">Conversations</th>
                <th className="pb-2">Tokens</th>
                <th className="pb-2">Cost</th>
                <th className="pb-2">Channel</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.slice(0, 50).map((c) => (
                <tr key={c.customerId} className="border-b">
                  <td className="py-2">{c.name}</td>
                  <td>{c.conversationCount}</td>
                  <td>{formatNumber(c.totalTokens)}</td>
                  <td>${c.estimatedCostUsd.toFixed(4)}</td>
                  <td>{c.channel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversations</CardTitle>
          <CardDescription>{filteredConversations.length} conversations tracked</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Customer</th>
                <th className="pb-2">Messages</th>
                <th className="pb-2">Tokens</th>
                <th className="pb-2">Provider</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredConversations.slice(0, 50).map((c) => (
                <tr key={c.conversationId} className="border-b">
                  <td className="py-2">{c.customerName}</td>
                  <td>{c.messages}</td>
                  <td>{formatNumber(c.totalTokens)}</td>
                  <td>{c.aiProvider}</td>
                  <td>{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Request History</CardTitle>
          <CardDescription>{data.aiHistory.length} recent AI usage events</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2">Time</th>
                <th className="pb-2">Provider</th>
                <th className="pb-2">Tokens</th>
                <th className="pb-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.aiHistory.slice(0, 30).map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="py-2">{new Date(e.createdAt).toLocaleString()}</td>
                  <td>{e.provider}</td>
                  <td>{formatNumber(e.totalTokens)}</td>
                  <td>${Number(e.estimatedCostUsd).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
