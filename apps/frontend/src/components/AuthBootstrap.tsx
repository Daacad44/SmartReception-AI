import { useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiResponse } from '@/lib/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

function isTokenExpired(token: string, bufferSeconds = 60): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { exp?: number };
    if (!payload.exp) return true;
    return payload.exp * 1000 < Date.now() + bufferSeconds * 1000;
  } catch {
    return true;
  }
}

/**
 * After hydration, refresh expired tokens in the background.
 * Does not block rendering — the axios 401 interceptor handles failures.
 */
export function AuthBootstrap() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;

    const { isAuthenticated, accessToken, refreshToken, setTokens, logout } =
      useAuthStore.getState();

    if (!isAuthenticated || !accessToken || !refreshToken) return;
    if (!isTokenExpired(accessToken)) return;

    let cancelled = false;

    (async () => {
      try {
        const response = await axios.post<
          ApiResponse<{ accessToken: string; refreshToken: string }>
        >(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken },
          { timeout: 10000 }
        );

        const body = response.data;
        if (!body.success || !body.data) {
          throw new Error(body.error || 'Token refresh failed');
        }

        if (!cancelled) {
          setTokens(body.data.accessToken, body.data.refreshToken);
        }
      } catch {
        if (!cancelled) {
          logout();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasHydrated]);

  return null;
}
