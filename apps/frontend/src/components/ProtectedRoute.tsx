import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setHasHydrated = useAuthStore((s) => s.setHasHydrated);

  // Safety net: never block the UI indefinitely if persist hydration stalls
  useEffect(() => {
    if (hasHydrated) return;
    const timer = window.setTimeout(() => setHasHydrated(true), 3000);
    return () => window.clearTimeout(timer);
  }, [hasHydrated, setHasHydrated]);

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" aria-label="Loading session" />
      </div>
    );
  }

  if (!isAuthenticated || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
