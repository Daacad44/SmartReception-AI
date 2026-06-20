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
}) {
  const redis = getRedisClient();
  const base = {
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: options.message ?? 'Too many requests, please try again later' },
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
