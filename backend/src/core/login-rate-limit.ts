import type { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { config } from '../config';
import { RateLimitError } from './errors';
import { logger } from './logger';

export const LOGIN_RATE_LIMIT_MAX = 10;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MESSAGE =
  'Too many login attempts. Please try again later.';

interface Counter {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, Counter>();

let redisClient: Redis | null = null;
let redisUnavailable = false;

function getRedis(): Redis | null {
  if (!config.redis.url || redisUnavailable) return null;
  if (!redisClient) {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    });
    redisClient.on('error', (err) => {
      logger.error('Redis login rate-limit client error', { error: String(err) });
      redisUnavailable = true;
    });
  }
  return redisClient;
}

export function normalizeLoginEmail(email: unknown): string {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

export function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]!.trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]!.trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function hitMemory(key: string, now: number): Counter {
  const existing = memoryStore.get(key);
  if (!existing || now >= existing.resetAt) {
    const fresh = { count: 1, resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS };
    memoryStore.set(key, fresh);
    return fresh;
  }
  existing.count += 1;
  memoryStore.set(key, existing);
  return existing;
}

async function hitRedis(key: string, now: number): Promise<Counter | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, LOGIN_RATE_LIMIT_WINDOW_MS);
    }
    const ttl = await redis.pttl(key);
    const resetAt = ttl > 0 ? now + ttl : now + LOGIN_RATE_LIMIT_WINDOW_MS;
    return { count, resetAt };
  } catch (error) {
    logger.warn('Login rate-limit Redis increment failed; falling back to memory', {
      error: error instanceof Error ? error.message : String(error),
    });
    redisUnavailable = true;
    return null;
  }
}

export async function consumeLoginAttempt(email: string, ip: string): Promise<{
  limited: boolean;
  retryAfterSec: number;
  remaining: number;
}> {
  const now = Date.now();
  const account = normalizeLoginEmail(email) || 'unknown';
  const keys = [
    `login:ip:${ip || 'unknown'}`,
    `login:acct:${account}`,
    `login:combo:${account}:${ip || 'unknown'}`,
  ];

  let limited = false;
  let retryAfterSec = 0;
  let remaining = LOGIN_RATE_LIMIT_MAX;

  for (const key of keys) {
    const redisHit = await hitRedis(key, now);
    const counter = redisHit ?? hitMemory(key, now);
    const left = Math.max(0, LOGIN_RATE_LIMIT_MAX - counter.count);
    remaining = Math.min(remaining, left);
    if (counter.count > LOGIN_RATE_LIMIT_MAX) {
      limited = true;
      retryAfterSec = Math.max(
        retryAfterSec,
        Math.ceil((counter.resetAt - now) / 1000)
      );
    }
  }

  if (limited) {
    logger.warn('Login rate limit exceeded', {
      ip,
      hasEmail: Boolean(normalizeLoginEmail(email)),
      retryAfterSec,
    });
  }

  return { limited, retryAfterSec: Math.max(retryAfterSec, 1), remaining };
}

export function loginRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const email = normalizeLoginEmail(
    req.body && typeof req.body === 'object'
      ? (req.body as { email?: unknown }).email
      : undefined
  );
  const ip = clientIp(req);

  void consumeLoginAttempt(email, ip)
    .then((result) => {
      res.setHeader('RateLimit-Limit', String(LOGIN_RATE_LIMIT_MAX));
      res.setHeader('RateLimit-Remaining', String(result.remaining));
      res.setHeader(
        'RateLimit-Reset',
        String(Math.ceil(Date.now() / 1000) + result.retryAfterSec)
      );

      if (!result.limited) {
        next();
        return;
      }

      res.setHeader('Retry-After', String(result.retryAfterSec));
      res.status(429).json({
        success: false,
        error: LOGIN_RATE_LIMIT_MESSAGE,
        message: LOGIN_RATE_LIMIT_MESSAGE,
        code: 'RATE_LIMITED',
      });
    })
    .catch(next);
}

export function resetLoginRateLimitForTests(): void {
  memoryStore.clear();
  redisUnavailable = false;
}

export function assertLoginRateLimit(email: string, ip?: string): void {
  const account = normalizeLoginEmail(email);
  const now = Date.now();
  const keys = [
    `login:ip:${ip || 'unknown'}`,
    `login:acct:${account || 'unknown'}`,
    `login:combo:${account || 'unknown'}:${ip || 'unknown'}`,
  ];
  for (const key of keys) {
    const record = memoryStore.get(key);
    if (record && now < record.resetAt && record.count > LOGIN_RATE_LIMIT_MAX) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      throw new RateLimitError(LOGIN_RATE_LIMIT_MESSAGE, retryAfterSec);
    }
  }
}
