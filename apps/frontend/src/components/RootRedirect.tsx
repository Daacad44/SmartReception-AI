import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { LandingPage } from '@/pages/LandingPage';

export function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (isAuthenticated && accessToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
}
