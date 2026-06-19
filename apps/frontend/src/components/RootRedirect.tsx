import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

export function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);

  if (isAuthenticated && accessToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}
