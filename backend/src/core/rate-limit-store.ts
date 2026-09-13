import rateLimit, { type Options, type RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { Request, Response, NextFunction } from 'express';
import { getRedis } from '../infrastructure/cache/redis';
import { config } from '../config';
import { logger } from './logger';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MAX = 10;
export const LOGIN_RATE_LIMIT_WINDOW_MS = LOGIN_WINDOW_MS;
export const LOGIN_RATE_LIMIT_MESSAGE = 'Too many login attempts. Please try again later.';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
  prefix?: string;
  skip?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}

function resolveRetryAfterSeconds(req: Request, windowMs: number): number {
  const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
  if (resetTime instanceof Date) {
    return Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
  }
  return Math.max(1, Math.ceil(windowMs / 1000));
}

function rateLimitedJson(req: Request, res: Response, message: string, windowMs: number): void {
  const retryAfter = resolveRetryAfterSeconds(req, windowMs);
  res.setHeader('Retry-After', String(retryAfter));
  logger.warn('Rate limit exceeded', {
    method: req.method,
    path: (req.originalUrl || req.path || '/').split('?')[0],
    ip: req.ip,
    retryAfter,
  });
  res.status(429).json({
    success: false,
    error: message,
    message,
    code: 'RATE_LIMITED',
  });
}

export function createRateLimiter(options: RateLimiterOptions): RateLimitRequestHandler {
  const message = options.message ?? 'Too many requests, please try again later';
  const prefix = options.prefix ?? 'rl:';

  const base: Partial<Options> = {
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests,
    skip: (req) => {
      if (req.method === 'OPTIONS') return true;
      return options.skip?.(req) ?? false;
    },
    handler: (req, res) => {
      rateLimitedJson(req, res, message, options.windowMs);
    },
    validate: {
      keyGeneratorIpFallback: false,
      xForwardedForHeader: false,
    },
  };

  if (options.keyGenerator) {
    base.keyGenerator = options.keyGenerator;
  }

  if (config.redis.url) {
    const redis = getRedis();
    return rateLimit({
      ...base,
      store: new RedisStore({
        prefix,
        sendCommand: async (command: string, ...args: string[]) => {
          const result = await redis.call(command, ...args);
          return result as RedisReply;
        },
      }),
    } as Options);
  }

  return rateLimit(base as Options);
}

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function loginEmail(req: Request): string {
  const email = req.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function createLoginRateLimiters(): Array<
  (req: Request, res: Response, next: NextFunction) => void
> {
  const ipLimiter = createRateLimiter({
    windowMs: LOGIN_WINDOW_MS,
    max: LOGIN_RATE_LIMIT_MAX,
    prefix: 'rl:login:ip:',
    message: LOGIN_RATE_LIMIT_MESSAGE,
    keyGenerator: (req) => `ip:${clientIp(req)}`,
  });

  const emailLimiter = createRateLimiter({
    windowMs: LOGIN_WINDOW_MS,
    max: LOGIN_RATE_LIMIT_MAX,
    prefix: 'rl:login:email:',
    message: LOGIN_RATE_LIMIT_MESSAGE,
    keyGenerator: (req) => {
      const email = loginEmail(req);
      return email ? `email:${email}` : `ip:${clientIp(req)}`;
    },
  });

  return [ipLimiter, emailLimiter];
}
