import { useQuery } from '@tanstack/react-query';
import api, { extractData } from '@/lib/api';
import {
  ALL_BUSINESS_TYPES,
  BUSINESS_TYPE_CATEGORIES,
  type BusinessTypeOption,
} from '@/lib/business-types';

interface BusinessTypesApiResponse {
  total: number;
  categories: { category: string; types: BusinessTypeOption[] }[];
  types: BusinessTypeOption[];
}

export function useBusinessTypes() {
  return useQuery({
    queryKey: ['business-types'],
    queryFn: async () => {
      try {
        const response = await api.get('/onboarding/business-types');
        const data = extractData<BusinessTypesApiResponse>(response);
        if (data.types?.length) return data;
      } catch {
        // Fall back to static catalog when API unavailable
      }
      return {
        total: ALL_BUSINESS_TYPES.length,
        categories: BUSINESS_TYPE_CATEGORIES,
        types: ALL_BUSINESS_TYPES,
      };
    },
    staleTime: 1000 * 60 * 60,
  });
}
