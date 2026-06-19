import { useEffect, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

const HYDRATION_TIMEOUT_MS = 800;

export function HydrationGate({ children }: { children: ReactNode }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const setHasHydrated = useAuthStore((s) => s.setHasHydrated);

  useEffect(() => {
    if (hasHydrated) return;
    const timer = window.setTimeout(() => setHasHydrated(true), HYDRATION_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [hasHydrated, setHasHydrated]);

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" aria-label="Loading application" />
      </div>
    );
  }

  return <>{children}</>;
}
