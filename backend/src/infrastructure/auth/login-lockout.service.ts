import { config } from '../../config';
import { RateLimitError } from '../../core/errors';
import { logger } from '../../core/logger';
import {
  LOGIN_RATE_LIMIT_MAX,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  LOGIN_RATE_LIMIT_MESSAGE,
  assertLoginRateLimit,
} from '../../core/login-rate-limit';

export function assertLoginAllowed(email: string, ip?: string): void {
  assertLoginRateLimit(email, ip);
}

export function recordFailedLogin(email: string, ip?: string): void {
  logger.warn('Failed login attempt', {
    ip: ip ?? 'unknown',
    hasEmail: Boolean(email),
  });
}

export function clearLoginAttempts(_email: string, _ip?: string): void {
  // Sliding window limiter; successful login does not reset the window.
}

export function getLoginLockoutConfig() {
  return {
    maxAttempts: LOGIN_RATE_LIMIT_MAX,
    lockoutMinutes: LOGIN_RATE_LIMIT_WINDOW_MS / 60000,
    redisBacked: Boolean(config.redis.url),
    message: LOGIN_RATE_LIMIT_MESSAGE,
  };
}

// Re-export so callers that previously threw ForbiddenError still type-check
// if they catch RateLimitError from assertLoginAllowed.
export { RateLimitError };
