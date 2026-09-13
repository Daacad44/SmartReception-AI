import rateLimit from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import Redis from 'ioredis';
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

export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  code?: string;
  skip?: (req: import('express').Request) => boolean;
}) {
  const redis = getRedisClient();
  const messageText = options.message ?? 'Too many requests, please try again later';
  const body = {
    success: false as const,
    error: messageText,
    message: messageText,
    code: options.code ?? 'RATE_LIMITED',
  };
  const skip = (req: import('express').Request) =>
    req.method === 'OPTIONS' || Boolean(options.skip?.(req));
  const base = {
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true as const,
    legacyHeaders: false as const,
    message: body,
    skip,
    handler: (_req: import('express').Request, res: import('express').Response) => {
      const reset = res.getHeader('RateLimit-Reset');
      const resetSec =
        typeof reset === 'string' || typeof reset === 'number' ? Number(reset) : NaN;
      const retryAfter = Number.isFinite(resetSec)
        ? Math.max(1, Math.ceil(resetSec - Date.now() / 1000))
        : Math.ceil(options.windowMs / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json(body);
    },
  };

  if (redis) {
    return rateLimit({
      ...base,
      store: new RedisStore({
        sendCommand: async (command: string, ...args: string[]) => {
          const result = await redis.call(command, ...args);
          return result as RedisReply;
        },
      }),
    });
  }

  return rateLimit(base);
}
