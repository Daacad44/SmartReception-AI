import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  Coins,
  LineChart,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import api, { extractData } from '@/lib/api';
import type {
  BusinessFinancialCard,
  PlatformFinancialDashboard,
  SimulatorResult,
} from '@/lib/financial-intelligence-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatNumber } from '@/lib/utils';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';

function money(value: number) {
  return `$${formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = 'default',
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: typeof Wallet;
  tone?: 'default' | 'success' | 'danger';
}) {
  const toneClass =
    tone === 'success' ? 'text-emerald-500' : tone === 'danger' ? 'text-red-500' : 'text-accent';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export function FinancialIntelligenceAdminPage() {
  const [search, setSearch] = useState('');

  const dashboardQuery = useQuery({
    queryKey: ['financial-intelligence', 'dashboard'],
    queryFn: async () => {
      const res = await api.get('/super-admin/financial-intelligence/dashboard');
      return extractData<PlatformFinancialDashboard>(res);
    },
    refetchInterval: 30_000,
  });

  const businessesQuery = useQuery({
    queryKey: ['financial-intelligence', 'businesses', search],
    queryFn: async () => {
      const res = await api.get('/super-admin/financial-intelligence/businesses', {
        params: { search: search || undefined },
      });
      return extractData<BusinessFinancialCard[]>(res);
    },
    refetchInterval: 30_000,
  });

  const simulatorQuery = useQuery({
    queryKey: ['financial-intelligence', 'simulator'],
    queryFn: async () => {
      const res = await api.post('/super-admin/financial-intelligence/simulator', {});
      return extractData<SimulatorResult[]>(res);
    },
  });

  const dashboard = dashboardQuery.data;
  const businesses = businessesQuery.data ?? [];

  if (dashboardQuery.isError) {
    return (
      <ErrorState
        message="Unable to load financial intelligence dashboard."
        onRetry={() => dashboardQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Wallet className="h-6 w-6 text-accent" />
            Financial Intelligence
          </h1>
          <p className="text-muted-foreground">
            Real production revenue, cost, and profit metrics across every business
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void dashboardQuery.refetch();
            void businessesQuery.refetch();
          }}
        >
          Refresh metrics
        </Button>
      </div>

      {dashboardQuery.isLoading ? (
        <LoadingState rows={8} />
      ) : dashboard ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="MRR" value={money(dashboard.totalMrrUsd)} icon={TrendingUp} />
            <MetricCard title="ARR" value={money(dashboard.totalArrUsd)} icon={LineChart} />
            <MetricCard
              title="Operating Cost"
              value={money(dashboard.totalOperatingCostUsd)}
              icon={Coins}
            />
            <MetricCard
              title="Net Profit"
              value={money(dashboard.netProfitUsd)}
              icon={Wallet}
              tone={dashboard.netProfitUsd >= 0 ? 'success' : 'danger'}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="AI Cost" value={money(dashboard.aiCostUsd)} icon={Coins} />
            <MetricCard title="WhatsApp Cost" value={money(dashboard.whatsappCostUsd)} icon={Coins} />
            <MetricCard title="Storage Cost" value={money(dashboard.storageCostUsd)} icon={Coins} />
            <MetricCard
              title="Profit Margin"
              value={`${dashboard.platformProfitMarginPercent.toFixed(1)}%`}
              subtitle={`${dashboard.profitableBusinessCount} profitable / ${dashboard.lossBusinessCount} at loss`}
              icon={dashboard.platformProfitMarginPercent >= 0 ? TrendingUp : TrendingDown}
              tone={dashboard.platformProfitMarginPercent >= 0 ? 'success' : 'danger'}
            />
          </div>

          <Tabs defaultValue="businesses">
            <TabsList>
              <TabsTrigger value="businesses">Businesses</TabsTrigger>
              <TabsTrigger value="rankings">Rankings</TabsTrigger>
              <TabsTrigger value="simulator">Pricing Simulator</TabsTrigger>
            </TabsList>

            <TabsContent value="businesses" className="space-y-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search businesses..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {businesses.map((row) => (
                  <Link
                    key={row.businessId}
                    to={`/admin/financial-intelligence/${row.businessId}`}
                  >
                    <Card className="h-full transition-shadow hover:shadow-lg">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-white">
                              <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{row.business?.name}</CardTitle>
                              <p className="text-xs text-muted-foreground">{row.planName ?? 'No plan'}</p>
                            </div>
                          </div>
                          <Badge variant={row.isProfitable ? 'default' : 'destructive'}>
                            {row.isProfitable ? 'Profitable' : 'At Risk'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Revenue</p>
                          <p className="font-semibold">{money(Number(row.monthlyRevenueUsd))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Cost</p>
                          <p className="font-semibold">{money(Number(row.totalOperatingCostUsd))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Profit</p>
                          <p className="font-semibold">{money(Number(row.netProfitUsd))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Margin</p>
                          <p className="font-semibold">{row.profitMarginPercent.toFixed(1)}%</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="rankings" className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top Revenue Businesses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dashboard.topRevenueBusinesses.map((item) => (
                    <div key={item.businessId} className="flex justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="font-medium">{money(item.revenueUsd)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Businesses Running at Loss
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dashboard.businessesAtLoss.length === 0 && (
                    <p className="text-sm text-muted-foreground">No businesses currently at loss.</p>
                  )}
                  {dashboard.businessesAtLoss.map((item) => (
                    <div key={item.businessId} className="flex justify-between text-sm">
                      <span>{item.name}</span>
                      <span className="font-medium text-red-500">{money(item.profitUsd)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="simulator">
              {simulatorQuery.isLoading ? (
                <LoadingState rows={4} />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {(simulatorQuery.data ?? []).map((plan) => (
                    <Card key={plan.planCode}>
                      <CardHeader>
                        <CardTitle className="capitalize">{plan.planCode.toLowerCase()}</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Est. Revenue</p>
                          <p className="font-semibold">{money(plan.estimatedMonthlyRevenueUsd)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Est. Cost</p>
                          <p className="font-semibold">{money(plan.estimatedMonthlyCostUsd)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Est. Profit</p>
                          <p className="font-semibold">{money(plan.estimatedProfitUsd)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Break-even</p>
                          <p className="font-semibold">{plan.breakEvenBusinessCount} businesses</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
