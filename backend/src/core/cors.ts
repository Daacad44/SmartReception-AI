import cors from 'cors';
import type { CorsOptions } from 'cors';
import type { Request, Response } from 'express';
import { config, PRODUCTION_FRONTEND_URL } from '../config';
import { logger } from './logger';

const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
];

const PRODUCTION_FRONTEND_ORIGINS = [
  'https://somreception.com',
  'https://www.somreception.com',
  'https://somreception.botandev.com',
  'https://www.somreception.botandev.com',
];

function parseExtraOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function getAllowedOrigins(): string[] {
  const origins = new Set<string>([
    config.frontendUrl.replace(/\/$/, ''),
    PRODUCTION_FRONTEND_URL.replace(/\/$/, ''),
    ...PRODUCTION_FRONTEND_ORIGINS,
    ...parseExtraOrigins(process.env.CORS_ALLOWED_ORIGINS),
  ]);

  if (process.env.VERCEL_URL) {
    origins.add(`https://${process.env.VERCEL_URL.replace(/\/$/, '')}`);
  }

  if (config.env !== 'production') {
    for (const origin of LOCAL_DEV_ORIGINS) {
      origins.add(origin);
    }
  }

  return [...origins];
}

export function isAllowedOrigin(origin: string | undefined, env = config.env): boolean {
  if (!origin) return true;

  const normalized = origin.replace(/\/$/, '');
  if (getAllowedOrigins().includes(normalized)) return true;
  if (normalized.endsWith('.vercel.app')) return true;
  if (env !== 'production' && isLocalhostOrigin(normalized)) return true;
  return false;
}

export function createCorsOptions(): CorsOptions {
  return {
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      logger.warn('CORS origin rejected', { origin });
      // Do not reflect unknown origins. Returning `false` skips CORS headers
      // for this request; the OPTIONS fallback still returns 204 so preflight
      // never 404s.
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
      'Origin',
    ],
    exposedHeaders: ['Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    optionsSuccessStatus: 204,
    maxAge: 86400,
    preflightContinue: false,
  };
}

export const corsMiddleware = cors(createCorsOptions());

/**
 * If CORS skipped an unknown origin, Express would otherwise 404 OPTIONS.
 * Return 204 without Access-Control-Allow-Origin so the browser still blocks
 * the request — but the preflight itself is a valid 2xx, not a routing miss.
 */
export function optionsFallback(_req: Request, res: Response): void {
  if (!res.headersSent) {
    res.status(204).end();
  }
}
