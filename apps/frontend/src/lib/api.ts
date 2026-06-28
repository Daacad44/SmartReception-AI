import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse } from '@/lib/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
const API_TIMEOUT_MS = 15_000;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: API_TIMEOUT_MS,
  withCredentials: true,
});

export function extractData<T>(response: AxiosResponse<ApiResponse<T>>): T {
  const body = response.data;
  if (!body.success) {
    throw new Error(body.error || body.message || 'Request failed');
  }
  if (body.data === undefined) {
    throw new Error('No data in response');
  }
  return body.data;
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiResponse & {
      details?: Array<{ field?: string; message?: string }>;
    };
    if (data?.details?.length) {
      return data.details.map((d) => d.message).filter(Boolean).join(' · ') || data.error || error.message;
    }
    return data?.error || data?.message || error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

export function isNetworkOrTimeoutError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  return !error.response || error.code === 'ECONNABORTED' || error.message.includes('timeout');
}

export function getErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiResponse | undefined;
    return data?.code;
  }
  return undefined;
}

function redirectToLogin() {
  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign('/login');
  }
}

function clearSession() {
  const { isAuthenticated, logout } = useAuthStore.getState();
  if (!isAuthenticated) return;
  logout();
  redirectToLogin();
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const businessId = useAuthStore.getState().currentBusinessId;
  if (businessId) {
    config.headers['X-Business-Id'] = businessId;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const storeRefreshToken = useAuthStore.getState().refreshToken;

  refreshPromise = axios
    .post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      `${API_BASE_URL}/auth/refresh`,
      storeRefreshToken ? { refreshToken: storeRefreshToken } : {},
      { timeout: 10_000, withCredentials: true }
    )
    .then((response) => {
      const tokens = extractData(response);
      useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
      return tokens.accessToken;
    })
    .catch((error) => {
      clearSession();
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      _timeoutRetry?: boolean;
    };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (
      isNetworkOrTimeoutError(error) &&
      !originalRequest._timeoutRetry &&
      originalRequest.method?.toUpperCase() === 'GET'
    ) {
      originalRequest._timeoutRetry = true;
      return api(originalRequest);
    }

    if (error.response?.status !== 401 || originalRequest._retry) {
      const code = getErrorCode(error);
      if (
        error.response?.status === 403 &&
        code === 'SUBSCRIPTION_EXPIRED' &&
        !window.location.pathname.startsWith('/subscription-expired')
      ) {
        window.location.assign('/subscription-expired');
      }
      return Promise.reject(error);
    }

    if (originalRequest.url?.includes('/auth/refresh')) {
      clearSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const accessToken = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

export default api;
