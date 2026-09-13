import { config } from '../config';
import { logger } from './logger';

/** Canonical production dashboard origin. */
export const CANONICAL_FRONTEND_ORIGIN = 'https://somreception.com';

/**
 * Explicit allowlist. Authenticated (credentialed) CORS must never use `*`.
 * Localhost entries are only honoured outside production.
 */
export const PRODUCTION_FRONTEND_ORIGINS = [
  CANONICAL_FRONTEND_ORIGIN,
  'https://www.somreception.com',
  'https://somreception.botandev.com',
  'https://www.somreception.botandev.com',
] as const;

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

function stripTrailingSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function extraOriginsFromEnv(): string[] {
  const fromList = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => stripTrailingSlash(item.trim()))
    .filter(Boolean);

  const singles = [config.frontendUrl, process.env.FRONTEND_URL, process.env.API_URL]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => stripTrailingSlash(value.trim()));

  if (process.env.VERCEL_URL) {
    singles.push(`https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}`);
  }

  return [...fromList, ...singles];
}

export function getAllowedOrigins(env: string = config.env): string[] {
  const allowed = new Set<string>([
    ...PRODUCTION_FRONTEND_ORIGINS,
    ...extraOriginsFromEnv(),
    'https://api.somreception.botandev.com',
  ]);

  if (env !== 'production') {
    for (const origin of DEV_ORIGINS) {
      allowed.add(origin);
    }
  } else {
    for (const origin of [...allowed]) {
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        allowed.delete(origin);
      }
    }
  }

  return [...allowed];
}

export function isOriginAllowed(
  origin: string | undefined,
  env: string = config.env
): boolean {
  if (!origin) {
    // Non-browser clients (curl, server-to-server, same-origin) send no Origin.
    return true;
  }

  if (getAllowedOrigins(env).includes(origin)) {
    return true;
  }

  if (origin.endsWith('.vercel.app') && origin.startsWith('https://')) {
    return true;
  }

  if (env !== 'production') {
    return origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
  }

  return false;
}

export function corsOriginDelegate(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void {
  if (isOriginAllowed(origin)) {
    callback(null, true);
    return;
  }

  logger.warn('CORS origin rejected', {
    origin,
    env: config.env,
  });
  callback(null, false);
}

export function getCorsOptions() {
  return {
    origin: corsOriginDelegate,
    credentials: true as const,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Business-Id',
      'X-Request-Id',
      'Accept',
    ],
    exposedHeaders: [
      'Retry-After',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'X-Request-Id',
    ],
    optionsSuccessStatus: 204,
    maxAge: 86400,
    preflightContinue: false,
  };
}
