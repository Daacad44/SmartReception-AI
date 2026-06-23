import { Building2, Users, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import api, { extractData } from '@/lib/api';
import { LoadingState } from '@/components/LoadingState';

interface PlatformStats {
  businesses: number;
  users: number;
  appointments: number;
  customers: number;
  activeSubscriptions: number;
  planBreakdown: Array<{ plan: string; count: number }>;
}

export function SuperAdminPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['super-admin', 'stats'],
    queryFn: async () => {
      const res = await api.get('/super-admin/stats');
      return extractData<PlatformStats>(res);
    },
  });

  const { data: businesses } = useQuery({
    queryKey: ['super-admin', 'businesses'],
    queryFn: async () => {
      const res = await api.get('/super-admin/businesses?limit=10');
      return extractData<Array<Record<string, unknown>>>(res);
    },
  });

  if (isLoading) return <LoadingState rows={6} />;

  const cards = [
    { label: 'Businesses', value: stats?.businesses ?? 0, icon: Building2 },
    { label: 'Users', value: stats?.users ?? 0, icon: Users },
    { label: 'Appointments', value: stats?.appointments ?? 0, icon: Calendar },
    { label: 'Active Subscriptions', value: stats?.activeSubscriptions ?? 0, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Super Admin</h1>
        <p className="text-sm text-muted-foreground">Platform-wide analytics and business management.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription Plans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats?.planBreakdown?.map((p) => (
              <div key={p.plan} className="flex items-center justify-between rounded-lg border p-3">
                <span className="font-medium">{p.plan}</span>
                <Badge variant="secondary">{p.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Businesses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {businesses?.map((b) => (
              <div key={String(b.id)} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">{String(b.name)}</p>
                  <p className="text-xs text-muted-foreground">{String(b.slug)}</p>
                </div>
                <Badge variant={b.isActive ? 'default' : 'secondary'}>
                  {b.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
