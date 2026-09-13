import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { createRateLimiter } from './rate-limit-store';
import { logger } from './logger';

export const LOGIN_RATE_LIMIT_MAX = 10;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MESSAGE = 'Too many login attempts. Please try again later.';

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedIp =
    typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined;
  return forwardedIp || req.ip || req.socket.remoteAddress || '127.0.0.1';
}

function normalizedLoginEmail(req: Request): string {
  const email = req.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function loginRateLimitHandler(): NonNullable<Parameters<typeof createRateLimiter>[0]['handler']> {
  return (req, res, _next, options) => {
    const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit
      ?.resetTime;
    const retryAfter = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : Math.ceil(options.windowMs / 1000);

    res.setHeader('Retry-After', String(retryAfter));
    logger.warn('Login rate limit exceeded', {
      requestId: req.requestId,
      retryAfter,
    });

    res.status(429).json({
      success: false,
      error: LOGIN_RATE_LIMIT_MESSAGE,
      message: LOGIN_RATE_LIMIT_MESSAGE,
      code: 'RATE_LIMITED',
      requestId: req.requestId,
    });
  };
}

export function createLoginRateLimiters(options?: {
  windowMs?: number;
  max?: number;
}): RequestHandler[] {
  const windowMs = options?.windowMs ?? LOGIN_RATE_LIMIT_WINDOW_MS;
  const max = options?.max ?? LOGIN_RATE_LIMIT_MAX;
  const handler = loginRateLimitHandler();

  const ipLimiter = createRateLimiter({
    windowMs,
    max,
    message: LOGIN_RATE_LIMIT_MESSAGE,
    keyGenerator: (req) => `login:ip:${ipKeyGenerator(clientIp(req))}`,
    handler,
  });

  const emailLimiter = createRateLimiter({
    windowMs,
    max,
    message: LOGIN_RATE_LIMIT_MESSAGE,
    keyGenerator: (req) => {
      const email = normalizedLoginEmail(req);
      return email ? `login:email:${email}` : `login:ip:${ipKeyGenerator(clientIp(req))}`;
    },
    handler,
  });

  return [ipLimiter, emailLimiter];
}
