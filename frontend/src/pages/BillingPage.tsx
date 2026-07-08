import { Download, Check, Mail } from 'lucide-react';
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
import { useSubscriptionLicense } from '@/components/SubscriptionGate';
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
  const { data: license } = useSubscriptionLicense();

  if (isError) {
    return <ErrorState message="Unable to load billing information." />;
  }

  if (isLoading) {
    return <LoadingState rows={6} />;
  }

  const currentPlan = billing?.plan ?? license?.plan?.code ?? 'FREE';

  const usageLabels: Record<string, string> = {
    conversations: 'Conversations',
    customers: 'Customers',
    teamMembers: 'Team Members',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">
          View your subscription and usage. Plan changes are managed by SomReception AI support.
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Subscription managed by administrator</p>
            <p className="text-xs text-muted-foreground">
              Self-service upgrades and renewals will be available when local payment integration is
              enabled.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="mailto:support@somreception.com?subject=Subscription%20Inquiry">
              <Mail className="mr-2 h-4 w-4" />
              Contact Support
            </a>
          </Button>
        </CardContent>
      </Card>

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
                {license?.status?.toLowerCase() ?? billing?.status ?? 'active'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">${billing?.price ?? PLAN_PRICES[currentPlan] ?? 0}</span>
              <span className="text-muted-foreground">/{billing?.billingCycle ?? 'month'}</span>
            </div>
            {license?.expiresAt && (
              <p className="text-sm text-muted-foreground">
                License expires: {new Date(license.expiresAt).toLocaleDateString()}
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
            <CardTitle className="text-base">License</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{license?.status?.toLowerCase() ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment</span>
              <span className="font-medium">{license?.paymentStatus ?? '—'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plan Features</CardTitle>
          <CardDescription>Included in your {currentPlan.toLowerCase()} plan</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(PLAN_FEATURES[currentPlan] ?? []).map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-success shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

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
                      {inv.stripeInvoiceId ? (
                        <Button variant="ghost" size="icon" asChild>
                          <a
                            href={`https://dashboard.stripe.com/invoices/${inv.stripeInvoiceId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="View invoice"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      ) : (
                        <Button variant="ghost" size="icon" disabled>
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
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
