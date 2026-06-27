import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Search, Filter, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingState } from '@/components/LoadingState';

interface SubscriptionRow {
  id: string;
  name: string;
  email: string | null;
  licenseStatus: string;
  isLicenseLocked: boolean;
  subscription: {
    plan: { code: string; name: string };
    expiresAt: string | null;
    status: string;
    paymentStatus: string;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  TRIAL: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  EXPIRED: 'bg-red-500/15 text-red-400 border-red-500/30',
  SUSPENDED: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  LOCKED: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  CANCELLED: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  PENDING: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

export function SubscriptionManagementPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'subscriptions', search, statusFilter],
    queryFn: async () => {
      const res = await api.get('/super-admin/subscriptions', {
        params: {
          limit: 50,
          search: search || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        },
      });
      return res.data as { data: SubscriptionRow[]; meta: { total: number } };
    },
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-50">
            <CreditCard className="h-7 w-7 text-amber-400" />
            Subscription Management
          </h1>
          <p className="text-sm text-slate-400">
            Enterprise control over business licenses, billing, and access.
          </p>
        </div>
        <Badge variant="outline" className="border-amber-500/30 text-amber-300">
          {data?.meta?.total ?? 0} businesses
        </Badge>
      </div>

      <Card className="border-slate-800 bg-slate-950">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg text-slate-200">All Businesses</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                className="border-slate-700 bg-slate-900 pl-9 text-slate-100"
                placeholder="Search businesses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] border-slate-700 bg-slate-900">
                <Filter className="mr-2 h-4 w-4 text-slate-400" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="TRIAL">Trial</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
                <SelectItem value="LOCKED">Locked</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState rows={8} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Business</TableHead>
                  <TableHead className="text-slate-400">Plan</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-slate-400">Expires</TableHead>
                  <TableHead className="text-slate-400">Payment</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer border-slate-800 hover:bg-slate-900/60"
                    onClick={() => navigate(`/admin/subscriptions/${row.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium text-slate-100">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.email}</div>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {row.subscription?.plan.name ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_COLORS[row.licenseStatus] ?? 'border-slate-700'}
                      >
                        {row.licenseStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {row.subscription?.expiresAt
                        ? new Date(row.subscription.expiresAt).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {row.subscription?.paymentStatus ?? '—'}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
