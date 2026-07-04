import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import api, { extractData } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { LoadingState } from '@/components/LoadingState';

export interface LicenseStatus {
  businessId: string;
  businessName: string;
  status: string;
  isLocked: boolean;
  plan: { code: string; name: string } | null;
  activatedAt: string | null;
  expiresAt: string | null;
  daysExpired: number;
  isPaused: boolean;
  paymentStatus: string;
  remainingTime: number | null;
}

export function useSubscriptionLicense() {
  return useQuery({
    queryKey: ['subscription', 'license'],
    queryFn: async () => {
      const res = await api.get('/billing/license');
      return extractData<LicenseStatus>(res);
    },
    staleTime: 30_000,
    retry: 1,
  });
}

const BLOCKED_STATUSES = new Set(['EXPIRED', 'SUSPENDED', 'CANCELLED', 'PENDING', 'LOCKED']);

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const { data, isLoading, isError } = useSubscriptionLicense();

  if (hasPermission('platform:admin')) {
    return <>{children}</>;
  }

  if (location.pathname === '/subscription-expired') {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <LoadingState rows={3} />
      </div>
    );
  }

  if (isError || !data) {
    return <>{children}</>;
  }

  if (data.isLocked || BLOCKED_STATUSES.has(data.status)) {
    return <Navigate to="/subscription-expired" replace />;
  }

  return <>{children}</>;
}
