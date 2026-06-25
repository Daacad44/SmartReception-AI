import { useEffect, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

const HYDRATION_TIMEOUT_MS = 3000;

export function HydrationGate({ children }: { children: ReactNode }) {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const setHasHydrated = useAuthStore((s) => s.setHasHydrated);

  useEffect(() => {
    if (hasHydrated) return;

    const markHydrated = () => setHasHydrated(true);

    if (useAuthStore.persist.hasHydrated()) {
      markHydrated();
      return;
    }

    const unsubFinish = useAuthStore.persist.onFinishHydration(markHydrated);
    const timer = window.setTimeout(markHydrated, HYDRATION_TIMEOUT_MS);

    return () => {
      unsubFinish();
      window.clearTimeout(timer);
    };
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
