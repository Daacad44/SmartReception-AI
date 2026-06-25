import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { useAuthReady } from '@/hooks/useAuthReady';
import api, { extractData } from '@/lib/api';
import { LandingPage } from '@/pages/LandingPage';

export function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const authReady = useAuthReady();

  const { data: status } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => extractData<{ completed: boolean; welcomeSeen: boolean }>(await api.get('/onboarding/status')),
    enabled: authReady && isAuthenticated && Boolean(accessToken),
    staleTime: 30_000,
  });

  if (isAuthenticated && accessToken) {
    if (status && !status.completed) return <Navigate to="/onboarding" replace />;
    if (status?.completed && !status.welcomeSeen) return <Navigate to="/welcome" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
}
