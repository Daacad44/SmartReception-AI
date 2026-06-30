import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Coins, TrendingUp, Wallet } from 'lucide-react';
import api, { extractData } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function BusinessFinancialDetailPage() {
  const { businessId } = useParams<{ businessId: string }>();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['financial-intelligence', 'business', businessId],
    enabled: Boolean(businessId),
    queryFn: async () => {
      const res = await api.get(`/super-admin/financial-intelligence/businesses/${businessId}`);
      return extractData<{
        business: { id: string; name: string; industry: string | null; country: string | null };
        profile: {
          planName: string | null;
          monthlyRevenueUsd: number;
          yearlyRevenueUsd: number;
          lifetimeRevenueUsd: number;
          aiCostUsd: number;
          whatsappCostUsd: number;
          emailCostUsd: number;
          storageCostUsd: number;
          infrastructureCostUsd: number;
          databaseCostUsd: number;
          monitoringCostUsd: number;
          backupCostUsd: number;
          totalOperatingCostUsd: number;
          grossProfitUsd: number;
          netProfitUsd: number;
          profitMarginPercent: number;
          isProfitable: boolean;
          isOperatingAtLoss: boolean;
          calculatedAt: string;
        } | null;
      }>(res);
    },
  });

  if (isError) {
    return <ErrorState message="Unable to load business financial profile." onRetry={() => refetch()} />;
  }

  if (isLoading || !data) return <LoadingState rows={8} />;

  const profile = data.profile;
  if (!profile) {
    return <ErrorState message="Financial profile not available for this business." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin/financial-intelligence">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Building2 className="h-6 w-6 text-accent" />
            {data.business.name}
          </h1>
          <p className="text-muted-foreground">
            {profile.planName ?? 'No plan'} · {data.business.country ?? 'Unknown country'}
          </p>
        </div>
        <Badge className="ml-auto" variant={profile.isProfitable ? 'default' : 'destructive'}>
          {profile.isProfitable ? 'Profitable' : 'At Loss'}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{money(Number(profile.monthlyRevenueUsd))}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Operating Cost</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{money(Number(profile.totalOperatingCostUsd))}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Net Profit</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{money(Number(profile.netProfitUsd))}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Profit Margin</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{profile.profitMarginPercent.toFixed(1)}%</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Yearly</span><span>{money(Number(profile.yearlyRevenueUsd))}</span></div>
            <div className="flex justify-between"><span>Lifetime</span><span>{money(Number(profile.lifetimeRevenueUsd))}</span></div>
            <div className="flex justify-between"><span>Gross Profit</span><span>{money(Number(profile.grossProfitUsd))}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Cost Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>AI</span><span>{money(Number(profile.aiCostUsd))}</span></div>
            <div className="flex justify-between"><span>WhatsApp</span><span>{money(Number(profile.whatsappCostUsd))}</span></div>
            <div className="flex justify-between"><span>Email</span><span>{money(Number(profile.emailCostUsd))}</span></div>
            <div className="flex justify-between"><span>Storage</span><span>{money(Number(profile.storageCostUsd))}</span></div>
            <div className="flex justify-between"><span>Infrastructure</span><span>{money(Number(profile.infrastructureCostUsd))}</span></div>
            <div className="flex justify-between"><span>Database</span><span>{money(Number(profile.databaseCostUsd))}</span></div>
            <div className="flex justify-between"><span>Monitoring</span><span>{money(Number(profile.monitoringCostUsd))}</span></div>
            <div className="flex justify-between"><span>Backup</span><span>{money(Number(profile.backupCostUsd))}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Profile Metadata
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Calculated at {new Date(profile.calculatedAt).toLocaleString()}
          {profile.isOperatingAtLoss && ' · Operating cost exceeds revenue'}
        </CardContent>
      </Card>
    </div>
  );
}
