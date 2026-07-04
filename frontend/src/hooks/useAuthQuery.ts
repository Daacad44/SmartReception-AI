import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { useAuthReady } from '@/hooks/useAuthReady';

type AuthQueryOptions<T> = Omit<UseQueryOptions<T>, 'enabled'> & {
  enabled?: boolean;
};

/**
 * Auth-gated query that resolves loading correctly when disabled pending auth.
 */
export function useAuthQuery<T>(options: AuthQueryOptions<T>) {
  const authReady = useAuthReady();
  const { enabled = true, ...queryOptions } = options;

  return useQuery({
    ...queryOptions,
    enabled: authReady && enabled,
  });
}

/** True while the first fetch is in progress and no cached data exists. */
export function isInitialLoading(
  isPending: boolean,
  isFetching: boolean,
  data: unknown
): boolean {
  return data === undefined && (isPending || isFetching);
}

export type { QueryKey };
