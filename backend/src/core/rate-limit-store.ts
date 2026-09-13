import rateLimit, { type Options, type RateLimitRequestHandler } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import Redis from 'ioredis';
import type { Request, Response } from 'express';
import { config } from '../config';
import { logger } from './logger';

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!config.redis.url) return null;
  if (!redisClient) {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    redisClient.on('error', (err) => logger.error('Redis rate-limit client error:', err));
  }
  return redisClient;
}

export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MAX = 10;
export const LOGIN_RATE_LIMIT_MESSAGE = 'Too many login attempts. Please try again later.';

function retryAfterSeconds(req: Request, windowMs: number): number {
  const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
  if (resetTime instanceof Date) {
    return Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
  }
  return Math.ceil(windowMs / 1000);
}

export function sendRateLimitedResponse(
  req: Request,
  res: Response,
  windowMs: number,
  message = LOGIN_RATE_LIMIT_MESSAGE
): void {
  const retryAfter = retryAfterSeconds(req, windowMs);
  res.setHeader('Retry-After', String(retryAfter));
  logger.warn('Rate limit exceeded', {
    path: req.originalUrl || req.path,
    method: req.method,
    retryAfter,
  });
  res.status(429).json({
    success: false,
    message,
    error: message,
    code: 'RATE_LIMITED',
  });
}

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  skip?: (req: Request) => boolean;
  keyGenerator?: (req: Request) => string;
  prefix?: string;
  skipSuccessfulRequests?: boolean;
}): RateLimitRequestHandler {
  const redis = getRedisClient();
  const messageText = options.message ?? 'Too many requests, please try again later';
  const base: Partial<Options> = {
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests,
    skip: options.skip,
    keyGenerator: options.keyGenerator,
    validate: options.keyGenerator ? { keyGeneratorIpFallback: false } : undefined,
    handler: (req, res) => {
      sendRateLimitedResponse(req, res, options.windowMs, messageText);
    },
  };

  if (redis) {
    return rateLimit({
      ...base,
      store: new RedisStore({
        prefix: options.prefix ?? 'rl:',
        sendCommand: async (command: string, ...args: string[]) => {
          const result = await redis.call(command, ...args);
          return result as RedisReply;
        },
      }),
    });
  }

  return rateLimit(base);
}

export function createLoginRateLimiters(): RateLimitRequestHandler[] {
  const skipPreflight = (req: Request) => req.method === 'OPTIONS';

  const ipLimiter = createRateLimiter({
    windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
    max: LOGIN_RATE_LIMIT_MAX,
    message: LOGIN_RATE_LIMIT_MESSAGE,
    prefix: 'rl:login:ip:',
    skip: skipPreflight,
    keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
  });

  const emailLimiter = createRateLimiter({
    windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
    max: LOGIN_RATE_LIMIT_MAX,
    message: LOGIN_RATE_LIMIT_MESSAGE,
    prefix: 'rl:login:email:',
    skip: skipPreflight,
    keyGenerator: (req) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      return email || 'missing-email';
    },
  });

  return [ipLimiter, emailLimiter];
}
