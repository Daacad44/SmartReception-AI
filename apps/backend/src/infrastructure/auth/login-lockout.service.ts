import Redis from 'ioredis';
import { config } from '../../config';
import { ForbiddenError } from '../../core/errors';
import { logger } from '../../core/logger';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60;

interface AttemptRecord {
  count: number;
  lockedUntil?: number;
}

// Fallback for environments without Redis (e.g. local dev). Keyed by email
// only — account lockout must hold regardless of which IP the attacker uses.
const memoryStore = new Map<string, AttemptRecord>();

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!config.redis.url) return null;
  if (!redisClient) {
    redisClient = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    redisClient.on('error', (err) => logger.error('Redis login-lockout client error:', err));
  }
  return redisClient;
}

function getKey(email: string): string {
  return `login-lockout:${email.toLowerCase()}`;
}

export async function assertLoginAllowed(email: string, ip?: string): Promise<void> {
  const key = getKey(email);
  const redis = getRedisClient();

  if (redis) {
    const lockedUntilRaw = await redis.get(`${key}:locked`);
    if (!lockedUntilRaw) return;

    const lockedUntil = Number(lockedUntilRaw);
    if (Date.now() < lockedUntil) {
      const minutes = Math.ceil((lockedUntil - Date.now()) / 60000);
      throw new ForbiddenError(`Too many failed login attempts. Try again in ${minutes} minute(s).`);
    }
    await redis.del(`${key}:locked`, `${key}:count`);
    return;
  }

  const record = memoryStore.get(key);
  if (!record?.lockedUntil) return;

  if (Date.now() < record.lockedUntil) {
    const minutes = Math.ceil((record.lockedUntil - Date.now()) / 60000);
    throw new ForbiddenError(`Too many failed login attempts. Try again in ${minutes} minute(s).`);
  }

  memoryStore.delete(key);
}

export async function recordFailedLogin(email: string, ip?: string): Promise<void> {
  const key = getKey(email);
  const redis = getRedisClient();

  if (redis) {
    const count = await redis.incr(`${key}:count`);
    if (count === 1) {
      await redis.expire(`${key}:count`, LOCKOUT_SECONDS);
    }
    if (count >= MAX_ATTEMPTS) {
      await redis.set(`${key}:locked`, String(Date.now() + LOCKOUT_SECONDS * 1000), 'EX', LOCKOUT_SECONDS);
      logger.warn(`Login lockout triggered for ${email} (last attempt from ${ip ?? 'unknown'})`);
    }
    return;
  }

  const record = memoryStore.get(key) ?? { count: 0 };
  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
    logger.warn(`Login lockout triggered for ${email} (last attempt from ${ip ?? 'unknown'})`);
  }

  memoryStore.set(key, record);
}

export async function clearLoginAttempts(email: string, ip?: string): Promise<void> {
  const key = getKey(email);
  const redis = getRedisClient();

  if (redis) {
    await redis.del(`${key}:count`, `${key}:locked`);
    return;
  }

  memoryStore.delete(key);
}

export function getLoginLockoutConfig() {
  return {
    maxAttempts: MAX_ATTEMPTS,
    lockoutMinutes: LOCKOUT_SECONDS / 60,
    redisBacked: Boolean(config.redis.url),
  };
}
