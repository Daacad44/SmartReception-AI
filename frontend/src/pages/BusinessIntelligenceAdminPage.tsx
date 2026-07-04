import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Building2,
  Coins,
  LineChart,
  Search,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import api, { extractData } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { formatNumber } from '@/lib/utils';
import { FinancialIntelligenceAdminPage } from './FinancialIntelligenceAdminPage';

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

interface AdminDashboard {
  overview: {
    businesses: number;
    customers: number;
    conversations: number;
    aiRequests: number;
    messagesSent: number;
    messagesReceived: number;
  };
  tokens: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    embeddingTokens: number;
    trainingTokens: number;
  };
  costs: {
    openai: number;
    gemini: number;
    claude: number;
    whatsapp: number;
    email: number;
    storage: number;
    infrastructure: number;
    operating: number;
  };
  financial: {
    revenue: number;
    profit: number;
    mrr: number;
    arr: number;
  };
  rankings: {
    topBusinesses: Array<{ businessId: string; name: string; revenueUsd?: number }>;
    topAiConsumers: Array<{ businessId: string; name: string; costUsd?: number }>;
    topStorageConsumers: Array<{ businessId: string; name: string; costUsd?: number }>;
  };
}

interface BusinessCard {
  businessId: string;
  name: string;
  totalCustomers: number;
  totalConversations: number;
  monthlyTokens: number;
  monthlyAiCost: number;
  revenue: number;
  profit: number;
}

export function BusinessIntelligenceAdminPage() {
  const [search, setSearch] = useState('');

  const dashboardQuery = useQuery({
    queryKey: ['business-intelligence-admin', 'dashboard'],
    queryFn: async () =>
      extractData<AdminDashboard>(await api.get('/super-admin/business-intelligence/dashboard')),
    refetchInterval: 30_000,
  });

  const businessesQuery = useQuery({
    queryKey: ['business-intelligence-admin', 'businesses', search],
    queryFn: async () => {
      const res = await api.get('/super-admin/business-intelligence/businesses', {
        params: { search: search || undefined, limit: 50 },
      });
      return extractData<BusinessCard[]>(res);
    },
    refetchInterval: 30_000,
  });

  const dashboard = dashboardQuery.data;
  const businesses = businessesQuery.data ?? [];

  if (dashboardQuery.isError) {
    return (
      <ErrorState
        message="Unable to load Business Intelligence dashboard."
        onRetry={() => dashboardQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="h-6 w-6 text-accent" />
            Business Intelligence
          </h1>
          <p className="text-muted-foreground">
            Unified platform analytics, AI usage, costs, revenue, and customer insights
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search businesses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="businesses">Businesses</TabsTrigger>
          <TabsTrigger value="financial">Financial Intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          {dashboardQuery.isLoading ? (
            <LoadingState rows={4} />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Businesses</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-bold">{formatNumber(dashboard?.overview.businesses ?? 0)}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Customers</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-bold">{formatNumber(dashboard?.overview.customers ?? 0)}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">AI Requests</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-bold">{formatNumber(dashboard?.overview.aiRequests ?? 0)}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Tokens</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-bold">{formatNumber(dashboard?.tokens.totalTokens ?? 0)}</CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Coins className="h-4 w-4" />Costs</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>AI (Gemini)</span><span>{money(dashboard?.costs.gemini ?? 0)}</span></div>
                    <div className="flex justify-between"><span>WhatsApp</span><span>{money(dashboard?.costs.whatsapp ?? 0)}</span></div>
                    <div className="flex justify-between"><span>Storage</span><span>{money(dashboard?.costs.storage ?? 0)}</span></div>
                    <div className="flex justify-between font-medium"><span>Operating</span><span>{money(dashboard?.costs.operating ?? 0)}</span></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" />Financial</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Revenue</span><span>{money(dashboard?.financial.revenue ?? 0)}</span></div>
                    <div className="flex justify-between"><span>Profit</span><span>{money(dashboard?.financial.profit ?? 0)}</span></div>
                    <div className="flex justify-between"><span>MRR</span><span>{money(dashboard?.financial.mrr ?? 0)}</span></div>
                    <div className="flex justify-between"><span>ARR</span><span>{money(dashboard?.financial.arr ?? 0)}</span></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" />Tokens</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Input</span><span>{formatNumber(dashboard?.tokens.inputTokens ?? 0)}</span></div>
                    <div className="flex justify-between"><span>Output</span><span>{formatNumber(dashboard?.tokens.outputTokens ?? 0)}</span></div>
                    <div className="flex justify-between"><span>Embedding</span><span>{formatNumber(dashboard?.tokens.embeddingTokens ?? 0)}</span></div>
                    <div className="flex justify-between"><span>Training</span><span>{formatNumber(dashboard?.tokens.trainingTokens ?? 0)}</span></div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" />Top Businesses</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {(dashboard?.rankings.topBusinesses ?? []).map((b) => (
                      <div key={b.businessId} className="flex justify-between border-b py-2">
                        <span>{b.name}</span>
                        <span>{money(b.revenueUsd ?? 0)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><LineChart className="h-4 w-4" />Top AI Consumers</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {(dashboard?.rankings.topAiConsumers ?? []).map((b) => (
                      <div key={b.businessId} className="flex justify-between border-b py-2">
                        <span>{b.name}</span>
                        <span>{money(b.costUsd ?? 0)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="businesses">
          {businessesQuery.isLoading ? (
            <LoadingState rows={6} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {businesses.map((business) => (
                <Card key={business.businessId}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-white">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{business.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{business.businessId.slice(0, 8)}…</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    <div><p className="text-muted-foreground">Customers</p><p className="font-semibold">{formatNumber(business.totalCustomers)}</p></div>
                    <div><p className="text-muted-foreground">Conversations</p><p className="font-semibold">{formatNumber(business.totalConversations)}</p></div>
                    <div><p className="text-muted-foreground">Tokens</p><p className="font-semibold">{formatNumber(business.monthlyTokens)}</p></div>
                    <div><p className="text-muted-foreground">AI Cost</p><p className="font-semibold">{money(business.monthlyAiCost)}</p></div>
                    <div><p className="text-muted-foreground">Revenue</p><p className="font-semibold">{money(business.revenue)}</p></div>
                    <div><p className="text-muted-foreground">Profit</p><p className="font-semibold">{money(business.profit)}</p></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="financial">
          <FinancialIntelligenceAdminPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
