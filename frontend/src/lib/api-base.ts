export function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

export function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const runtime = (window as Window & { __SR_API_URL__?: string }).__SR_API_URL__;
    if (typeof runtime === 'string' && runtime.trim()) {
      return stripTrailingSlash(runtime.trim());
    }
  }

  const env = import.meta.env.VITE_API_URL;
  if (typeof env === 'string' && env.trim()) {
    return stripTrailingSlash(env.trim());
  }

  return '/api/v1';
}
