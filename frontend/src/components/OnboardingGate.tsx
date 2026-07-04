import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api, { extractData, isNetworkOrTimeoutError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useAuthReady } from '@/hooks/useAuthReady';
import { LoadingState } from '@/components/LoadingState';
import { ErrorState } from '@/components/ErrorState';

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

  const { data: status, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => extractData<OnboardingStatus>(await api.get('/onboarding/status')),
    enabled: authReady && isAuthenticated && Boolean(accessToken),
    staleTime: 30_000,
    retry: (failureCount, err) => isNetworkOrTimeoutError(err) && failureCount < 2,
  });

  if (!isAuthenticated || !accessToken) {
    return <Navigate to="/login" replace state={{ redirect: location.pathname }} />;
  }

  if (isLoading || (isFetching && !status)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <LoadingState rows={3} />
        <p className="text-sm text-muted-foreground">Fadlan sug...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <ErrorState
          title="Wax yar ayaa khaldamay"
          message={
            isNetworkOrTimeoutError(error)
              ? 'Xiriirka server-ka ayaa cilad galay. Fadlan mar kale isku day.'
              : 'Fadlan mar kale isku day.'
          }
          retryLabel="Mar kale isku day"
          onRetry={() => refetch()}
        />
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

  const { data: status, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => extractData<OnboardingStatus>(await api.get('/onboarding/status')),
    enabled: authReady && isAuthenticated && Boolean(accessToken),
    staleTime: 30_000,
    retry: (failureCount, err) => isNetworkOrTimeoutError(err) && failureCount < 2,
  });

  if (!isAuthenticated || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading || (isFetching && !status)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <LoadingState rows={3} />
        <p className="text-sm text-muted-foreground">Fadlan sug...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <ErrorState
          title="Wax yar ayaa khaldamay"
          message={
            isNetworkOrTimeoutError(error)
              ? 'Xiriirka server-ka ayaa cilad galay. Fadlan mar kale isku day.'
              : 'Fadlan mar kale isku day.'
          }
          retryLabel="Mar kale isku day"
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (status?.completed) {
    return <Navigate to={status.welcomeSeen ? '/dashboard' : '/welcome'} replace />;
  }

  return <>{children}</>;
}
