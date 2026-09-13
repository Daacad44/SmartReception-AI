import { config } from '../../config';
import { TooManyRequestsError } from '../../core/errors';
import { logger } from '../../core/logger';
import { LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW_MS } from '../../core/rate-limit-store';

const MAX_ATTEMPTS = LOGIN_RATE_LIMIT_MAX;
const LOCKOUT_MS = LOGIN_RATE_LIMIT_WINDOW_MS;

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
}

const memoryStore = new Map<string, AttemptRecord>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emailKey(email: string): string {
  return `login_fail:email:${normalizeEmail(email)}`;
}

function ipKey(ip?: string): string {
  return `login_fail:ip:${ip || 'unknown'}`;
}

async function readRecord(key: string): Promise<AttemptRecord | undefined> {
  if (config.redis.url) {
    try {
      const { getRedis } = await import('../cache/redis');
      const raw = await getRedis().get(key);
      if (!raw) return undefined;
      return JSON.parse(raw) as AttemptRecord;
    } catch (error) {
      logger.warn('Login lockout Redis read failed; using memory fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return memoryStore.get(key);
}

async function writeRecord(key: string, record: AttemptRecord): Promise<void> {
  memoryStore.set(key, record);
  if (!config.redis.url) return;
  try {
    const { getRedis } = await import('../cache/redis');
    const ttlSeconds = Math.max(1, Math.ceil((record.firstAttemptAt + LOCKOUT_MS - Date.now()) / 1000));
    await getRedis().set(key, JSON.stringify(record), 'EX', ttlSeconds);
  } catch (error) {
    logger.warn('Login lockout Redis write failed; memory fallback in use', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function deleteRecord(key: string): Promise<void> {
  memoryStore.delete(key);
  if (!config.redis.url) return;
  try {
    const { getRedis } = await import('../cache/redis');
    await getRedis().del(key);
  } catch {
    // ignore
  }
}

function remainingSeconds(record: AttemptRecord): number {
  return Math.max(1, Math.ceil((record.firstAttemptAt + LOCKOUT_MS - Date.now()) / 1000));
}

function isWindowExpired(record: AttemptRecord): boolean {
  return Date.now() >= record.firstAttemptAt + LOCKOUT_MS;
}

async function assertKeyAllowed(key: string): Promise<void> {
  const record = await readRecord(key);
  if (!record) return;
  if (isWindowExpired(record)) {
    await deleteRecord(key);
    return;
  }
  if (record.count >= MAX_ATTEMPTS) {
    throw new TooManyRequestsError(
      'Too many login attempts. Please try again later.',
      remainingSeconds(record)
    );
  }
}

export async function assertLoginAllowed(email: string, ip?: string): Promise<void> {
  await assertKeyAllowed(emailKey(email));
  await assertKeyAllowed(ipKey(ip));
}

async function incrementKey(key: string): Promise<void> {
  const existing = await readRecord(key);
  const record: AttemptRecord =
    !existing || isWindowExpired(existing)
      ? { count: 1, firstAttemptAt: Date.now() }
      : { count: existing.count + 1, firstAttemptAt: existing.firstAttemptAt };

  if (record.count >= MAX_ATTEMPTS) {
    logger.warn('Login lockout window reached', { keyType: key.startsWith('login_fail:email:') ? 'email' : 'ip' });
  }

  await writeRecord(key, record);
}

export async function recordFailedLogin(email: string, ip?: string): Promise<void> {
  await incrementKey(emailKey(email));
  await incrementKey(ipKey(ip));
}

export async function clearLoginAttempts(email: string, ip?: string): Promise<void> {
  await deleteRecord(emailKey(email));
  await deleteRecord(ipKey(ip));
}

export function getLoginLockoutConfig() {
  return {
    maxAttempts: MAX_ATTEMPTS,
    lockoutMinutes: LOCKOUT_MS / 60000,
    redisBacked: Boolean(config.redis.url),
  };
}
