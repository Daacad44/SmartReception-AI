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
 * After Zustand rehydration, validate the session and refresh expired tokens
 * before protected API queries are enabled.
 */
export function AuthBootstrap() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;

    const { isAuthenticated, accessToken, refreshToken, setTokens, logout, setSessionReady } =
      useAuthStore.getState();

    if (!isAuthenticated) {
      setSessionReady(true);
      return;
    }

    if (!accessToken) {
      if (!refreshToken) {
        logout();
      }
      setSessionReady(true);
      return;
    }

    if (!isTokenExpired(accessToken) || !refreshToken) {
      setSessionReady(true);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = await axios.post<
          ApiResponse<{ accessToken: string; refreshToken: string }>
        >(`${API_BASE_URL}/auth/refresh`, { refreshToken });

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
      } finally {
        if (!cancelled) {
          setSessionReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasHydrated]);

  return null;
}
