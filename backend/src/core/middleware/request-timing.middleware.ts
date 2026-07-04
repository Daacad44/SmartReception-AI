import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS || '500');

export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration >= SLOW_REQUEST_MS) {
      logger.warn('Slow request', {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: duration,
        businessId: req.user?.businessId,
        userId: req.user?.userId,
      });
    }
  });

  next();
}
