import { CreditCard, Download, Check, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBilling } from '@/hooks/useApi';
import { formatCurrency } from '@/lib/utils';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';

const PLAN_FEATURES: Record<string, string[]> = {
  FREE: ['500 conversations/mo', '1 team member', 'Basic AI'],
  STARTER: ['1,000 conversations/mo', '2 team members', 'Basic AI', 'Email support'],
  BUSINESS: ['3,000 conversations/mo', '5 team members', 'Advanced AI', 'Analytics'],
  PROFESSIONAL: ['5,000 conversations/mo', '10 team members', 'Advanced AI', 'Priority support', 'Analytics'],
  ENTERPRISE: ['Unlimited conversations', 'Unlimited team', 'Custom AI training', 'Dedicated support', 'SLA'],
};

const PLAN_PRICES: Record<string, number> = {
  FREE: 0,
  STARTER: 29,
  BUSINESS: 79,
  PROFESSIONAL: 99,
  ENTERPRISE: 299,
};

export function BillingPage() {
  const { data: billing, isLoading, isError } = useBilling();

  if (isError) {
    return <ErrorState message="Unable to load billing information." />;
  }

  if (isLoading) {
    return <LoadingState rows={6} />;
  }

  const currentPlan = billing?.plan ?? 'PROFESSIONAL';
  const plans = Object.entries(PLAN_PRICES)
    .filter(([key]) => key !== 'FREE')
    .map(([key, price]) => ({
      key,
      name: key.charAt(0) + key.slice(1).toLowerCase(),
      price,
      features: PLAN_FEATURES[key] ?? [],
      current: key === currentPlan,
    }));

  const usageLabels: Record<string, string> = {
    conversations: 'Conversations',
    customers: 'Customers',
    teamMembers: 'Team Members',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and billing details</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>
                  You are on the {currentPlan.toLowerCase()} plan
                </CardDescription>
              </div>
              <Badge variant="success" className="capitalize">
                {billing?.status ?? 'active'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">${billing?.price ?? PLAN_PRICES[currentPlan] ?? 0}</span>
              <span className="text-muted-foreground">/{billing?.billingCycle ?? 'month'}</span>
            </div>
            {billing?.nextBillingDate && (
              <p className="text-sm text-muted-foreground">
                Next billing date: {billing.nextBillingDate}
              </p>
            )}

            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Usage This Period</h4>
              {billing?.usage &&
                Object.entries(billing.usage).map(([key, val]) => {
                  const pct = val.limit > 0 ? (val.used / val.limit) * 100 : 0;
                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{usageLabels[key] ?? key}</span>
                        <span className="font-medium">
                          {val.used.toLocaleString()} / {val.limit.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={Math.min(pct, 100)} className="h-2" />
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <CreditCard className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                No payment method on file. Stripe integration coming soon.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Available Plans</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card key={plan.key} className={plan.current ? 'border-accent ring-1 ring-accent' : ''}>
              <CardContent className="p-6">
                {plan.current && (
                  <Badge className="mb-3 bg-accent text-white">Current Plan</Badge>
                )}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">${plan.price}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-success shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`mt-6 w-full ${plan.current ? '' : 'bg-accent hover:bg-accent/90'}`}
                  variant={plan.current ? 'outline' : 'default'}
                  disabled={plan.current}
                >
                  {plan.current ? 'Current Plan' : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Upgrade
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice History</CardTitle>
        </CardHeader>
        <CardContent>
          {!billing?.invoices?.length ? (
            <EmptyState
              title="No invoices yet"
              description="Invoices will appear here once billing is activated."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {billing.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.id.slice(0, 8)}</TableCell>
                    <TableCell>{inv.date}</TableCell>
                    <TableCell>{formatCurrency(inv.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="success" className="capitalize text-[10px]">
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
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
