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
  businesses?: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    industry?: string;
    plan?: string;
  }>;
  isSuperAdmin?: boolean;
  accessToken?: string;
  refreshToken?: string;
  requiresTwoFactor?: boolean;
  tempToken?: string;
  requiresOnboarding?: boolean;
}

function completeAuthLogin(
  data: LoginResponse,
  login: (accessToken: string, refreshToken: string, user: UserProfile, isSuperAdmin?: boolean) => void
) {
  if (!data.accessToken || !data.refreshToken) {
    throw new Error('Invalid login response');
  }
  const profile = mapLoginToProfile(data);
  login(data.accessToken, data.refreshToken, profile, data.isSuperAdmin ?? false);
}

function mapLoginToProfile(data: LoginResponse): UserProfile {
  const businesses = data.businesses ?? [];
  const primaryRole = businesses[0]?.role ?? 'AGENT';
  return {
    id: data.user.id,
    email: data.user.email,
    firstName: data.user.firstName,
    lastName: data.user.lastName,
    avatar: data.user.avatarUrl ?? undefined,
    role: primaryRole,
    businesses: businesses.map((b) => ({
      id: b.id,
      name: b.name,
      industry: b.industry ?? 'OTHER',
      plan: b.plan ?? 'STARTER',
      role: b.role,
    })),
  };
}

function mapProfileToUserProfile(data: ProfileResponse): UserProfile {
  const businesses = data.businesses ?? [];
  const primaryRole = businesses[0]?.role ?? 'AGENT';
  return {
    id: data.id,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    avatar: data.avatarUrl ?? undefined,
    role: primaryRole,
    businesses: businesses.map((b) => ({
      id: b.id,
      name: b.name,
      industry: b.industry ?? 'OTHER',
      plan: b.plan ?? 'STARTER',
      role: b.role,
    })),
  };
}

interface VerifyOtpResponse {
  message: string;
  requiresOnboarding?: boolean;
  user?: LoginResponse['user'];
  businesses?: LoginResponse['businesses'];
  accessToken?: string;
  refreshToken?: string;
}

interface RegisterResponse {
  message: string;
  email: string;
  requiresApproval?: boolean;
  requiresVerification?: boolean;
}

interface ProfileResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  isEmailVerified?: boolean;
  isSuperAdmin?: boolean;
  needsOnboarding?: boolean;
  onboardingCompleted?: boolean;
  welcomeSeen?: boolean;
  businesses?: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    industry?: string;
    plan?: string;
  }>;
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
      if (data.requiresTwoFactor && data.tempToken) {
        navigate(`/verify-2fa?tempToken=${encodeURIComponent(data.tempToken)}`);
        return;
      }
      completeAuthLogin(data, login);
      toast.success('Welcome back!');
      const redirect = searchParams.get('redirect');
      const destination =
        data.isSuperAdmin && !(data.businesses?.length)
          ? '/super-admin'
          : data.requiresOnboarding
            ? '/onboarding'
            : redirect && redirect.startsWith('/')
              ? redirect
              : '/dashboard';
      navigate(destination);
    },
    onError: (error, variables) => {
      const message = getErrorMessage(error);
      const code = getErrorCode(error);
      const email = encodeURIComponent(variables.email);
      toast.error(message);
      if (code === 'EMAIL_NOT_VERIFIED') {
        navigate(`/verify-otp?email=${email}`);
      } else if (code === 'APPLICATION_AWAITING_CODE') {
        navigate(`/activate?email=${email}`);
      } else if (code === 'APPLICATION_PENDING') {
        navigate(`/application-pending?email=${email}`);
      }
    },
  });

  const verifyTwoFactorMutation = useMutation({
    mutationFn: async ({ tempToken, code }: { tempToken: string; code: string }) => {
      const response = await api.post('/auth/verify-2fa', { tempToken, code });
      return extractData<LoginResponse>(response);
    },
    onSuccess: (data) => {
      completeAuthLogin(data, login);
      toast.success('Welcome back!');
      const destination =
        data.isSuperAdmin && !(data.businesses?.length)
          ? '/super-admin'
          : data.requiresOnboarding
            ? '/onboarding'
            : '/dashboard';
      navigate(destination);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await api.post('/auth/register', data);
      return extractData<RegisterResponse>(response);
    },
    onSuccess: (data) => {
      toast.success('Application submitted for review.');
      navigate(`/application-pending?email=${encodeURIComponent(data.email)}`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const verifyApprovalMutation = useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const response = await api.post('/auth/verify-approval', { email, code });
      return extractData<LoginResponse>(response);
    },
    onSuccess: (data) => {
      completeAuthLogin(data, login);
      toast.success('Account activated. Welcome to SomReception AI!');
      navigate(data.requiresOnboarding ? '/onboarding' : '/dashboard');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const resendApprovalMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await api.post('/auth/resend-approval', { email });
      return extractData<{ message: string }>(response);
    },
    onSuccess: () => {
      toast.success('A new activation code has been sent.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ email, code }: { email: string; code: string }) => {
      const response = await api.post('/auth/verify-otp', { email, code });
      return extractData<VerifyOtpResponse>(response);
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
    verifyTwoFactorLogin: verifyTwoFactorMutation.mutate,
    register: registerMutation.mutate,
    verifyOtp: verifyOtpMutation.mutate,
    resendOtp: resendOtpMutation.mutate,
    verifyApproval: verifyApprovalMutation.mutate,
    isVerifyingApproval: verifyApprovalMutation.isPending,
    resendApproval: resendApprovalMutation.mutate,
    isResendingApproval: resendApprovalMutation.isPending,
    forgotPassword: forgotPasswordMutation.mutate,
    resetPassword: resetPasswordMutation.mutate,
    logout,
    isLoggingIn: loginMutation.isPending,
    isVerifyingTwoFactor: verifyTwoFactorMutation.isPending,
    isRegistering: registerMutation.isPending,
    isVerifyingOtp: verifyOtpMutation.isPending,
    isResendingOtp: resendOtpMutation.isPending,
    isSendingReset: forgotPasswordMutation.isPending,
    isResettingPassword: resetPasswordMutation.isPending,
    profile: profileQuery.data,
  };
}
