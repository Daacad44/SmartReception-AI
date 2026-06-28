import { Clock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { GovernanceApprovalRequest } from '@/lib/governance';

interface GovernanceApprovalBannerProps {
  request: GovernanceApprovalRequest;
  onEnterCode?: () => void;
}

const statusConfig = {
  PENDING: {
    icon: Clock,
    label: 'Waiting for Approval',
    variant: 'warning' as const,
    message: 'Your request was submitted. A Super Administrator will review it shortly.',
  },
  APPROVED: {
    icon: ShieldCheck,
    label: 'Approval Granted',
    variant: 'success' as const,
    message: 'Enter your activation code to complete this action.',
  },
  REJECTED: {
    icon: ShieldAlert,
    label: 'Rejected',
    variant: 'destructive' as const,
    message: 'This request was rejected by your administrator.',
  },
};

export function GovernanceApprovalBanner({ request, onEnterCode }: GovernanceApprovalBannerProps) {
  const config = statusConfig[request.status as keyof typeof statusConfig];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{config.label}</p>
              <Badge variant={config.variant}>{request.actionLabel}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{config.message}</p>
            {request.rejectionReason && (
              <p className="mt-1 text-sm text-destructive">{request.rejectionReason}</p>
            )}
          </div>
        </div>
        {request.status === 'APPROVED' && onEnterCode && (
          <Button onClick={onEnterCode} className="shrink-0">
            Enter Activation Code
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
