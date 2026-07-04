import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const CHUNK_REFRESH_KEY = 'smartreception-chunk-refresh';

/**
 * Wraps React.lazy with a one-time full-page reload on chunk load failure
 * (common after deployments when cached index.html references stale hashes).
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const module = await factory();
      sessionStorage.removeItem(CHUNK_REFRESH_KEY);
      return module;
    } catch (error) {
      const hasRefreshed = sessionStorage.getItem(CHUNK_REFRESH_KEY) === 'true';
      if (!hasRefreshed) {
        sessionStorage.setItem(CHUNK_REFRESH_KEY, 'true');
        window.location.reload();
        return { default: (() => null) as unknown as T };
      }
      throw error;
    }
  });
}
