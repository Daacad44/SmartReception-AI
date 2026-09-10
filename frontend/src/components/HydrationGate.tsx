import { useEffect, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { BrandLogo } from '@/components/Logo';
import { BRAND_NAME } from '@/lib/brand';
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
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#090B14]">
        <BrandLogo variant="icon" className="h-16 w-16" />
        <Loader2 className="h-7 w-7 animate-spin text-[#F59E0B]" aria-label={`Loading ${BRAND_NAME}`} />
      </div>
    );
  }

  return <>{children}</>;
}
