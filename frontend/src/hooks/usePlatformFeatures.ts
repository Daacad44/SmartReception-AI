import { useQuery } from '@tanstack/react-query';
import api, { extractData } from '@/lib/api';
import type { FeaturePublicMap } from '@/lib/feature-management-types';
import { useAuthStore } from '@/stores/auth.store';

export function usePlatformFeatures() {
  const businessId = useAuthStore((s) => s.currentBusinessId);

  const query = useQuery({
    queryKey: ['platform-features', 'public-map', businessId],
    queryFn: async () => {
      const res = await api.get('/super-admin/feature-management/public-map');
      return extractData<FeaturePublicMap>(res);
    },
    staleTime: 60_000,
  });

  const isFeatureEnabled = (featureKey: string): boolean => {
    // Fail open while the feature map has not successfully loaded (still
    // loading OR the request errored). Route access is still enforced on the
    // backend, so a transient/failed fetch must not hide the entire navigation.
    if (!query.data) return true;
    return query.data[featureKey]?.enabled ?? false;
  };

  return {
    ...query,
    featureMap: query.data ?? {},
    isFeatureEnabled,
  };
}
