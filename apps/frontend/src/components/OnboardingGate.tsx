import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api, { extractData } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useAuthReady } from '@/hooks/useAuthReady';
import { LoadingState } from '@/components/LoadingState';

interface OnboardingStatus {
  completed: boolean;
  currentStep: number;
  welcomeSeen: boolean;
  hasBusiness: boolean;
}

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const authReady = useAuthReady();
  const location = useLocation();

  const { data: status, isLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => extractData<OnboardingStatus>(await api.get('/onboarding/status')),
    enabled: authReady && isAuthenticated && Boolean(accessToken),
    staleTime: 30_000,
  });

  if (!isAuthenticated || !accessToken) {
    return <Navigate to="/login" replace state={{ redirect: location.pathname }} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState rows={3} />
      </div>
    );
  }

  if (status && !status.completed) {
    return <Navigate to="/onboarding" replace />;
  }

  if (status?.completed && !status.welcomeSeen && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
}

export function OnboardingOnlyRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const authReady = useAuthReady();

  const { data: status, isLoading } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => extractData<OnboardingStatus>(await api.get('/onboarding/status')),
    enabled: authReady && isAuthenticated && Boolean(accessToken),
    staleTime: 30_000,
  });

  if (!isAuthenticated || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState rows={3} />
      </div>
    );
  }

  if (status?.completed) {
    return <Navigate to={status.welcomeSeen ? '/dashboard' : '/welcome'} replace />;
  }

  return <>{children}</>;
}
