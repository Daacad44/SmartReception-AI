import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api, { apiCall } from '@/lib/api';
import type { LoginCredentials, RegisterData, UserProfile } from '@/lib/types';
import { mockBusinesses, mockUser } from '@/lib/mock-data';
import { useAuthStore } from '@/stores/auth.store';

export function useAuth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, login, logout: storeLogout } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await api.post('/auth/login', credentials);
      return response.data;
    },
    onSuccess: (data) => {
      const tokens = data.data ?? data;
      const profile: UserProfile = {
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
        businesses: mockBusinesses.map((b) => ({
          id: b.id,
          name: b.name,
          industry: b.industry,
          plan: b.plan,
        })),
      };
      login(tokens.accessToken, tokens.refreshToken, profile);
      toast.success('Welcome back!');
      navigate('/dashboard');
    },
    onError: () => {
      const profile: UserProfile = {
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
        businesses: mockBusinesses.map((b) => ({
          id: b.id,
          name: b.name,
          industry: b.industry,
          plan: b.plan,
        })),
      };
      login('demo-access-token', 'demo-refresh-token', profile);
      toast.info('Using demo mode — API unavailable');
      navigate('/dashboard');
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await api.post('/auth/register', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Account created! Please sign in.');
      navigate('/login');
    },
    onError: () => {
      toast.info('Demo mode — redirecting to dashboard');
      const profile: UserProfile = {
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
        businesses: mockBusinesses.map((b) => ({
          id: b.id,
          name: b.name,
          industry: b.industry,
          plan: b.plan,
        })),
      };
      login('demo-access-token', 'demo-refresh-token', profile);
      navigate('/dashboard');
    },
  });

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    storeLogout();
    queryClient.clear();
    navigate('/login');
  };

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () =>
      apiCall(async () => {
        const { data } = await api.get('/auth/profile');
        return (data.data ?? data) as UserProfile;
      }, null),
    enabled: isAuthenticated,
  });

  return {
    user,
    isAuthenticated,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    logout,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    profile: profileQuery.data,
  };
}
