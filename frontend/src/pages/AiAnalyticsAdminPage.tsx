import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Bot, Coins, Search, Sparkles, Users } from 'lucide-react';
import api, { extractData } from '@/lib/api';
import type { BusinessAnalyticsCard } from '@/lib/ai-analytics-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/lib/utils';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';

export function AiAnalyticsAdminPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['super-admin', 'ai-analytics', 'businesses', search],
    queryFn: async () => {
      const res = await api.get('/super-admin/ai-analytics/businesses', {
        params: { limit: 100, search: search || undefined },
      });
      return extractData<BusinessAnalyticsCard[]>(res);
    },
    refetchInterval: 15_000,
  });

  if (isError) {
    return <ErrorState message="Unable to load AI analytics." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-6 w-6 text-accent" />
            Enterprise AI Analytics
          </h1>
          <p className="text-muted-foreground">Live analytics for every business — real database metrics</p>
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

      {isLoading ? (
        <LoadingState rows={6} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((business) => (
            <Link key={business.businessId} to={`/admin/ai-analytics/${business.businessId}`}>
              <Card className="h-full transition-shadow hover:shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-white">
                        {business.logoUrl ? (
                          <img src={business.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <Building2 className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base">{business.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">{business.industry}</p>
                        <p className="text-xs text-muted-foreground">ID: {business.businessId.slice(0, 8)}…</p>
                      </div>
                    </div>
                    <Badge variant={business.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {business.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-muted-foreground">Customers</p>
                      <p className="font-semibold">
                        {formatNumber(business.totalCustomers)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          ({business.activeCustomers} active)
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Conversations</p>
                      <p className="font-semibold">{formatNumber(business.totalConversations)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">AI Messages</p>
                      <p className="font-semibold">{formatNumber(business.totalAiMessages)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Lifetime Tokens</p>
                      <p className="font-semibold">{formatNumber(business.lifetimeTokens)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Monthly Tokens</p>
                      <p className="font-semibold">{formatNumber(business.monthlyTokens)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg / Conversation</p>
                      <p className="font-semibold">{formatNumber(business.avgTokensPerConversation)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Owner</p>
                      <p className="truncate font-medium">
                        {business.owner
                          ? `${business.owner.firstName} ${business.owner.lastName}`
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Activity</p>
                      <p className="font-medium">
                        {business.lastActivity
                          ? new Date(business.lastActivity).toLocaleDateString()
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Health Score</p>
                      <p className="font-medium">{business.healthScore ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">KB Size</p>
                      <p className="font-medium">{formatNumber(business.knowledgeBaseSize)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      ${business.monthlyAiCost.toFixed(4)} / mo
                    </span>
                    <span className="flex items-center gap-1">
                      <Bot className="h-3 w-3" />
                      {business.topProvider ?? 'gemini'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {business.tokenSavingsPercent.toFixed(0)}% saved
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
