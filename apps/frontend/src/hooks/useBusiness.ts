import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api, { extractData, getErrorMessage } from '@/lib/api';
import type { Business } from '@/lib/entities';
import { useAuthStore } from '@/stores/auth.store';

export function useBusiness() {
  const queryClient = useQueryClient();
  const { businesses, currentBusinessId, setCurrentBusiness, setBusinesses } = useAuthStore();

  const currentBusinessQuery = useQuery({
    queryKey: ['business', currentBusinessId],
    queryFn: async () => {
      const response = await api.get('/business');
      return extractData<{
        id: string;
        name: string;
        industry: string;
        logoUrl?: string | null;
        subscription?: { plan: string } | null;
      }>(response);
    },
    enabled: !!currentBusinessId,
  });

  const currentBusiness = businesses.find((b) => b.id === currentBusinessId) ?? businesses[0];

  const switchBusinessMutation = useMutation({
    mutationFn: async (businessId: string) => {
      const response = await api.post('/auth/switch-business', { businessId });
      const tokens = extractData<{ accessToken: string; refreshToken: string }>(response);
      return { businessId, tokens };
    },
    onSuccess: ({ businessId, tokens }) => {
      useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
      setCurrentBusiness(businessId);
      queryClient.invalidateQueries();
      toast.success('Business switched');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const enrichedBusiness: Business | undefined = currentBusiness
    ? {
        ...currentBusiness,
        industry: currentBusinessQuery.data?.industry ?? currentBusiness.industry,
        plan: currentBusinessQuery.data?.subscription?.plan ?? currentBusiness.plan,
        logo: currentBusinessQuery.data?.logoUrl ?? undefined,
      }
    : undefined;

  return {
    businesses,
    currentBusiness: enrichedBusiness,
    currentBusinessId,
    switchBusiness: switchBusinessMutation.mutate,
    setBusinesses,
    isLoading: currentBusinessQuery.isLoading,
    isError: currentBusinessQuery.isError,
  };
}
