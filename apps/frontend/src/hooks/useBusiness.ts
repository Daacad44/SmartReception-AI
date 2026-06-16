import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api, { apiCall } from '@/lib/api';
import { mockBusinesses, type Business } from '@/lib/mock-data';
import { useAuthStore } from '@/stores/auth.store';

export function useBusiness() {
  const queryClient = useQueryClient();
  const { businesses, currentBusinessId, setCurrentBusiness, setBusinesses } = useAuthStore();

  const businessesQuery = useQuery<Business[]>({
    queryKey: ['businesses'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/businesses');
        return data.data ?? data;
      }, mockBusinesses),
  });

  const currentBusiness = businesses.find((b) => b.id === currentBusinessId) ?? businesses[0];

  const switchBusinessMutation = useMutation({
    mutationFn: async (businessId: string) => {
      await api.post('/auth/switch-business', { businessId });
      return businessId;
    },
    onSuccess: (businessId) => {
      setCurrentBusiness(businessId);
      queryClient.invalidateQueries();
      toast.success('Business switched');
    },
    onError: (_err, businessId) => {
      setCurrentBusiness(businessId);
      queryClient.invalidateQueries();
      toast.info('Switched business (demo mode)');
    },
  });

  return {
    businesses: businessesQuery.data ?? businesses,
    currentBusiness,
    currentBusinessId,
    switchBusiness: switchBusinessMutation.mutate,
    setBusinesses,
    isLoading: businessesQuery.isLoading,
  };
}
