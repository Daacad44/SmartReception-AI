import { config } from '../../config';
import { TooManyRequestsError } from '../../core/errors';
import { logger } from '../../core/logger';
import { getRedis } from '../cache/redis';
import {
  LOGIN_RATE_LIMIT_MAX,
  LOGIN_RATE_LIMIT_MESSAGE,
  LOGIN_RATE_LIMIT_WINDOW_MS,
} from '../../core/rate-limit-store';

const MAX_ATTEMPTS = LOGIN_RATE_LIMIT_MAX;
const LOCKOUT_MS = LOGIN_RATE_LIMIT_WINDOW_MS;

interface AttemptRecord {
  count: number;
  lockedUntil?: number;
}

const memoryStore = new Map<string, AttemptRecord>();

function getKey(email: string, ip?: string): string {
  return `login:fail:${email.toLowerCase()}:${ip ?? 'unknown'}`;
}

function remainingSeconds(lockedUntil: number): number {
  return Math.max(1, Math.ceil((lockedUntil - Date.now()) / 1000));
}

function throwRateLimited(lockedUntil: number): never {
  throw new TooManyRequestsError(LOGIN_RATE_LIMIT_MESSAGE, remainingSeconds(lockedUntil));
}

async function redisGet(key: string): Promise<AttemptRecord | null> {
  if (!config.redis.url) return null;
  try {
    const raw = await getRedis().get(key);
    if (!raw) return null;
    return JSON.parse(raw) as AttemptRecord;
  } catch (error) {
    logger.warn('Login lockout Redis read failed; using memory store', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

async function redisSet(key: string, record: AttemptRecord): Promise<void> {
  if (!config.redis.url) return;
  try {
    const ttlSeconds = Math.max(1, Math.ceil(LOCKOUT_MS / 1000));
    await getRedis().set(key, JSON.stringify(record), 'PX', LOCKOUT_MS);
    await getRedis().expire(key, ttlSeconds);
  } catch (error) {
    logger.warn('Login lockout Redis write failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export async function assertLoginAllowed(email: string, ip?: string): Promise<void> {
  const key = getKey(email, ip);
  const record = (await redisGet(key)) ?? memoryStore.get(key);
  if (!record?.lockedUntil) return;

  if (Date.now() < record.lockedUntil) {
    throwRateLimited(record.lockedUntil);
  }

  memoryStore.delete(key);
}

export async function recordFailedLogin(email: string, ip?: string): Promise<void> {
  const key = getKey(email, ip);
  const record = (await redisGet(key)) ?? memoryStore.get(key) ?? { count: 0 };
  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
    logger.warn('Login lockout triggered', { ip: ip ?? 'unknown' });
  }

  memoryStore.set(key, record);
  await redisSet(key, record);
}

export async function clearLoginAttempts(email: string, ip?: string): Promise<void> {
  const key = getKey(email, ip);
  memoryStore.delete(key);
  if (!config.redis.url) return;
  try {
    await getRedis().del(key);
  } catch {
    // non-fatal
  }
}

export function getLoginLockoutConfig() {
  return {
    maxAttempts: MAX_ATTEMPTS,
    lockoutMinutes: LOCKOUT_MS / 60000,
    redisBacked: Boolean(config.redis.url),
  };
}
