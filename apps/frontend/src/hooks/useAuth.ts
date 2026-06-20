import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import api, { extractData, getErrorMessage, getErrorCode } from '@/lib/api';
import type { LoginCredentials, RegisterData, UserProfile } from '@/lib/types';
import { useAuthStore } from '@/stores/auth.store';
import { useAuthReady } from '@/hooks/useAuthReady';

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

interface RegisterResponse {
  message: string;
  email: string;
  requiresVerification: boolean;
}

interface ProfileResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  isEmailVerified?: boolean;
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
      role: b.role,
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
      role: b.role,
    })),
  };
}

export function useAuth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
      const redirect = searchParams.get('redirect');
      navigate(redirect && redirect.startsWith('/') ? redirect : '/dashboard');
    },
    onError: (error, variables) => {
      const message = getErrorMessage(error);
      toast.error(message);
      if (getErrorCode(error) === 'EMAIL_NOT_VERIFIED') {
        navigate(`/verify-otp?email=${encodeURIComponent(variables.email)}`);
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await api.post('/auth/register', data);
      return extractData<RegisterResponse>(response);
    },
    onSuccess: (data) => {
      toast.success('Account created! Enter the code sent to your email.');
      navigate(`/verify-otp?email=${encodeURIComponent(data.email)}`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const response = await api.post('/auth/verify-otp', { email, code });
      return extractData<{ message: string }>(response);
    },
    onSuccess: () => {
      toast.success('Email verified successfully!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const resendOtpMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await api.post('/auth/resend-otp', { email });
      return extractData<{ message: string }>(response);
    },
    onSuccess: () => {
      toast.success('Verification code sent');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await api.post('/auth/forgot-password', { email });
      return extractData(response);
    },
    onSuccess: () => {
      toast.success('If the email exists, a reset code has been sent');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({
      email,
      code,
      password,
    }: {
      email: string;
      code: string;
      password: string;
    }) => {
      const response = await api.post('/auth/reset-password', { email, code, password });
      return extractData(response);
    },
    onSuccess: () => {
      toast.success('Password reset successfully. Please sign in.');
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

  const authReady = useAuthReady();
  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await api.get('/auth/profile');
      const data = extractData<ProfileResponse>(response);
      return mapProfileToUserProfile(data);
    },
    enabled: authReady,
  });

  return {
    user,
    isAuthenticated,
    login: loginMutation.mutate,
    register: registerMutation.mutate,
    verifyOtp: verifyOtpMutation.mutate,
    resendOtp: resendOtpMutation.mutate,
    forgotPassword: forgotPasswordMutation.mutate,
    resetPassword: resetPasswordMutation.mutate,
    logout,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isVerifyingOtp: verifyOtpMutation.isPending,
    isResendingOtp: resendOtpMutation.isPending,
    isSendingReset: forgotPasswordMutation.isPending,
    isResettingPassword: resetPasswordMutation.isPending,
    profile: profileQuery.data,
  };
}
