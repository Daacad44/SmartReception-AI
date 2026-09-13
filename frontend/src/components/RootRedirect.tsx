import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useAuthReady } from '@/hooks/useAuthReady';
import api, { extractData } from '@/lib/api';
import { LandingPage } from '@/pages/LandingPage';
import { BrandLogo } from '@/components/Logo';

export function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const authReady = useAuthReady();

  const { data: status, isLoading: isStatusLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => extractData<{ completed: boolean; welcomeSeen: boolean }>(await api.get('/onboarding/status')),
    enabled: authReady && isAuthenticated && Boolean(accessToken) && !isSuperAdmin,
    staleTime: 30_000,
  });

  if (!authReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#090B14]">
        <BrandLogo variant="icon" className="h-16 w-16" />
        <Loader2 className="h-7 w-7 animate-spin text-[#F59E0B]" aria-label="Loading..." />
      </div>
    );
  }

  if (isAuthenticated && accessToken) {
    if (isSuperAdmin) {
      return <Navigate to="/super-admin" replace />;
    }
    if (isStatusLoading) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#090B14]">
          <BrandLogo variant="icon" className="h-16 w-16" />
          <Loader2 className="h-7 w-7 animate-spin text-[#F59E0B]" aria-label="Loading..." />
        </div>
      );
    }
    if (status && !status.completed) return <Navigate to="/onboarding" replace />;
    if (status?.completed && !status.welcomeSeen) return <Navigate to="/welcome" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
}
