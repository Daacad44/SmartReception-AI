import { config } from '../../config';
import { ForbiddenError } from '../../core/errors';
import { logger } from '../../core/logger';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AttemptRecord {
  count: number;
  lockedUntil?: number;
}

const memoryStore = new Map<string, AttemptRecord>();

function getKey(email: string, ip?: string): string {
  return `${email.toLowerCase()}:${ip ?? 'unknown'}`;
}

export function assertLoginAllowed(email: string, ip?: string): void {
  const key = getKey(email, ip);
  const record = memoryStore.get(key);
  if (!record?.lockedUntil) return;

  if (Date.now() < record.lockedUntil) {
    const minutes = Math.ceil((record.lockedUntil - Date.now()) / 60000);
    throw new ForbiddenError(
      `Too many failed login attempts. Try again in ${minutes} minute(s).`
    );
  }

  memoryStore.delete(key);
}

export function recordFailedLogin(email: string, ip?: string): void {
  const key = getKey(email, ip);
  const record = memoryStore.get(key) ?? { count: 0 };
  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
    logger.warn(`Login lockout triggered for ${email} from ${ip ?? 'unknown'}`);
  }

  memoryStore.set(key, record);
}

export function clearLoginAttempts(email: string, ip?: string): void {
  memoryStore.delete(getKey(email, ip));
}

export function getLoginLockoutConfig() {
  return {
    maxAttempts: MAX_ATTEMPTS,
    lockoutMinutes: LOCKOUT_MS / 60000,
    redisBacked: Boolean(config.redis.url),
  };
}
