import type { CorsOptions } from 'cors';
import { config } from '../config';
import { logger } from './logger';

export const PRODUCTION_FRONTEND_ORIGINS = [
  'https://somreception.com',
  'https://www.somreception.com',
  'https://somreception.botandev.com',
  'https://www.somreception.botandev.com',
] as const;

const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function extraOriginsFromEnv(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS ?? '';
  return raw
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
}

export function getAllowedOrigins(): string[] {
  const origins = new Set<string>([
    normalizeOrigin(config.frontendUrl),
    ...PRODUCTION_FRONTEND_ORIGINS,
    ...extraOriginsFromEnv(),
  ]);

  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL.replace(/\/$/, '')}`);
  }

  if (config.env !== 'production') {
    for (const origin of LOCAL_DEV_ORIGINS) {
      origins.add(origin);
    }
  }

  return [...origins].filter(Boolean);
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    // Non-browser clients (curl, health checks, server-to-server) send no Origin.
    return true;
  }

  const normalized = normalizeOrigin(origin);
  if (getAllowedOrigins().includes(normalized)) {
    return true;
  }

  // Vercel preview deployments. Production custom domains must be explicit.
  if (config.env !== 'production' && normalized.endsWith('.vercel.app')) {
    return true;
  }

  if (normalized.endsWith('.vercel.app') && process.env.ALLOW_VERCEL_PREVIEW_ORIGINS === 'true') {
    return true;
  }

  return false;
}

export function createCorsOptions(): CorsOptions {
  return {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      logger.warn('CORS origin rejected', { origin: origin ?? null });
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Business-Id',
      'X-Request-Id',
      'Accept',
    ],
    exposedHeaders: ['Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'X-Request-Id'],
    optionsSuccessStatus: 204,
    maxAge: 86400,
    preflightContinue: false,
  };
}
