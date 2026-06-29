import { useQuery } from '@tanstack/react-query';
import api, { extractData } from '@/lib/api';
import type { FeaturePublicMap } from '@/lib/feature-management-types';

export function usePlatformFeatures() {
  const query = useQuery({
    queryKey: ['platform-features', 'public-map'],
    queryFn: async () => {
      const res = await api.get('/super-admin/feature-management/public-map');
      return extractData<FeaturePublicMap>(res);
    },
    staleTime: 60_000,
  });

  const isFeatureEnabled = (featureKey: string): boolean => {
    return query.data?.[featureKey]?.enabled ?? true;
  };

  return {
    ...query,
    featureMap: query.data ?? {},
    isFeatureEnabled,
  };
}
