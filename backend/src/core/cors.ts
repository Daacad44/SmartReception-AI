import type { CorsOptions } from 'cors';
import { config } from '../config';
import { logger } from './logger';

export const PRODUCTION_FRONTEND_ORIGINS = [
  'https://somreception.com',
  'https://www.somreception.com',
  'https://somreception.botandev.com',
] as const;

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
] as const;

export interface CorsRuntimeConfig {
  frontendUrl: string;
  extraOrigins: string[];
  vercelUrl?: string;
  env: string;
}

export function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export function resolveCorsRuntimeConfig(): CorsRuntimeConfig {
  return {
    frontendUrl: config.frontendUrl,
    extraOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
    vercelUrl: process.env.VERCEL_URL,
    env: config.env,
  };
}

export function getAllowedOrigins(runtime: CorsRuntimeConfig = resolveCorsRuntimeConfig()): string[] {
  const origins = new Set<string>();
  if (runtime.frontendUrl) {
    origins.add(runtime.frontendUrl.replace(/\/$/, ''));
  }
  for (const origin of PRODUCTION_FRONTEND_ORIGINS) {
    origins.add(origin);
  }
  if (runtime.vercelUrl) {
    origins.add(`https://${runtime.vercelUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}`);
  }
  for (const origin of runtime.extraOrigins) {
    origins.add(origin);
  }
  if (runtime.env !== 'production') {
    for (const origin of DEV_ORIGINS) {
      origins.add(origin);
    }
  }
  return [...origins];
}

export function isOriginAllowed(
  origin: string | undefined,
  runtime: CorsRuntimeConfig = resolveCorsRuntimeConfig()
): boolean {
  if (!origin) return true;
  if (getAllowedOrigins(runtime).includes(origin)) return true;
  if (origin.startsWith('https://') && origin.endsWith('.vercel.app')) return true;
  return runtime.env !== 'production';
}

export function createCorsOptions(
  runtime: CorsRuntimeConfig = resolveCorsRuntimeConfig()
): CorsOptions {
  return {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin, runtime)) {
        callback(null, true);
        return;
      }
      logger.warn('CORS origin rejected', { origin });
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
    exposedHeaders: [
      'Retry-After',
      'RateLimit-Limit',
      'RateLimit-Remaining',
      'RateLimit-Reset',
      'X-Request-Id',
    ],
    optionsSuccessStatus: 204,
    maxAge: 86400,
  };
}
