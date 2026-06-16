import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import api, { extractData, getErrorMessage } from '@/lib/api';
import type { LoginCredentials, RegisterData, UserProfile } from '@/lib/types';
import { useAuthStore } from '@/stores/auth.store';

interface LoginResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string | null;
  };
  businesses: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    industry?: string;
    plan?: string;
  }>;
  accessToken: string;
  refreshToken: string;
}

interface ProfileResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  businesses: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    industry?: string;
    plan?: string;
  }>;
}

function mapLoginToProfile(data: LoginResponse): UserProfile {
  const primaryRole = data.businesses[0]?.role ?? 'AGENT';
  return {
    id: data.user.id,
    email: data.user.email,
    firstName: data.user.firstName,
    lastName: data.user.lastName,
    avatar: data.user.avatarUrl ?? undefined,
    role: primaryRole,
    businesses: data.businesses.map((b) => ({
      id: b.id,
      name: b.name,
      industry: b.industry ?? 'OTHER',
      plan: b.plan ?? 'STARTER',
    })),
  };
}

function mapProfileToUserProfile(data: ProfileResponse): UserProfile {
  const primaryRole = data.businesses[0]?.role ?? 'AGENT';
  return {
    id: data.id,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    avatar: data.avatarUrl ?? undefined,
    role: primaryRole,
    businesses: data.businesses.map((b) => ({
      id: b.id,
      name: b.name,
      industry: b.industry ?? 'OTHER',
      plan: b.plan ?? 'STARTER',
    })),
  };
}

export function useAuth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, login, logout: storeLogout } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await api.post('/auth/login', credentials);
      return extractData<LoginResponse>(response);
    },
    onSuccess: (data) => {
      const profile = mapLoginToProfile(data);
      login(data.accessToken, data.refreshToken, profile);
      toast.success('Welcome back!');
      navigate('/dashboard');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await api.post('/auth/register', data);
      return extractData<LoginResponse>(response);
    },
    onSuccess: (data) => {
      const profile = mapLoginToProfile(data);
      login(data.accessToken, data.refreshToken, profile);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const logout = async () => {
    try {
      const refreshToken = useAuthStore.getState().refreshToken;
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // ignore logout API errors
    }
    storeLogout();
    queryClient.clear();
    navigate('/login');
  };

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await api.get('/auth/profile');
      const data = extractData<ProfileResponse>(response);
      return mapProfileToUserProfile(data);
    },
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
