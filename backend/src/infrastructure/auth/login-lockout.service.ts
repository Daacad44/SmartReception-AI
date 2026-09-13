import { config } from '../../config';
import { logger } from '../../core/logger';

interface AttemptRecord {
  count: number;
}

const memoryStore = new Map<string, AttemptRecord>();

function getKey(email: string, ip?: string): string {
  return `${email.toLowerCase()}:${ip ?? 'unknown'}`;
}

/**
 * Login brute-force blocking is enforced by the Redis-backed login rate limiter
 * (10 attempts / 15 minutes per IP and per email). This store only records
 * failed attempts for diagnostics and must not lock accounts.
 */
export function assertLoginAllowed(_email: string, _ip?: string): void {
  // Intentionally a no-op. Rate limiting is server-side via login-rate-limit.ts.
}

export function recordFailedLogin(email: string, ip?: string): void {
  const key = getKey(email, ip);
  const record = memoryStore.get(key) ?? { count: 0 };
  record.count += 1;
  memoryStore.set(key, record);
  if (record.count === 10 || record.count % 25 === 0) {
    logger.warn('Repeated failed login attempts', {
      attemptCount: record.count,
      ip: ip ?? 'unknown',
    });
  }
}

export function clearLoginAttempts(email: string, ip?: string): void {
  memoryStore.delete(getKey(email, ip));
}

export function getLoginLockoutConfig() {
  return {
    maxAttempts: 10,
    lockoutMinutes: 15,
    redisBacked: Boolean(config.redis.url),
  };
}
