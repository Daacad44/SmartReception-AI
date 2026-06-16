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

const plans = [
  {
    name: 'Starter',
    price: 29,
    features: ['1,000 conversations/mo', '2 team members', 'Basic AI', 'Email support'],
  },
  {
    name: 'Professional',
    price: 99,
    features: ['5,000 conversations/mo', '10 team members', 'Advanced AI', 'Priority support', 'Analytics'],
    current: true,
  },
  {
    name: 'Enterprise',
    price: 299,
    features: ['Unlimited conversations', 'Unlimited team', 'Custom AI training', 'Dedicated support', 'SLA'],
  },
];

export function BillingPage() {
  const { data: billing } = useBilling();

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
                  You are on the {billing?.plan ?? 'Professional'} plan
                </CardDescription>
              </div>
              <Badge variant="success" className="capitalize">
                {billing?.status ?? 'active'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">${billing?.price ?? 99}</span>
              <span className="text-muted-foreground">/{billing?.billingCycle ?? 'month'}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Next billing date: {billing?.nextBillingDate ?? '2025-07-15'}
            </p>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Usage This Period</h4>
              {billing?.usage && Object.entries(billing.usage).map(([key, val]: [string, { used: number; limit: number }]) => {
                const pct = (val.used / val.limit) * 100;
                const labels: Record<string, string> = {
                  conversations: 'Conversations',
                  aiMessages: 'AI Messages',
                  teamMembers: 'Team Members',
                  storage: 'Storage (GB)',
                };
                return (
                  <div key={key} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{labels[key] ?? key}</span>
                      <span className="font-medium">
                        {val.used.toLocaleString()} / {val.limit.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={pct} className="h-2" />
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
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Visa ending in 4242</p>
                <p className="text-xs text-muted-foreground">Expires 12/2027</p>
              </div>
            </div>
            <Button variant="outline" className="w-full">Update Payment Method</Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Available Plans</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.name} className={plan.current ? 'border-accent ring-1 ring-accent' : ''}>
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
              {billing?.invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.id}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
