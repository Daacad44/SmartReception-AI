import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config';
import {
  AppError,
  ConflictError,
  NotFoundError,
  RouteNotFoundError,
  ValidationError,
  WhatsAppDeliveryError,
} from './errors';
import { extractAppFrame } from './error-stack.util';
import { logger } from './logger';

const NOISY_ROUTE_PATTERNS = [
  /^\/favicon\.ico$/i,
  /^\/robots\.txt$/i,
  /^\/sitemap\.xml$/i,
  /^\/sse$/i,
  /^\/api\/mcp$/i,
  /^\/\.well-known\//i,
  /^\/apple-touch-icon/i,
];

type ErrorBody = {
  success: false;
  error: string;
  code: string;
  requestId?: string;
  details?: unknown;
  stack?: string;
};

function requestPath(req: Request): string {
  const raw = req.originalUrl || req.url || req.path || '/';
  return raw.split('?')[0] || '/';
}

function isNoisyRoute(path: string): boolean {
  return NOISY_ROUTE_PATTERNS.some((pattern) => pattern.test(path));
}

function isJsonBodyError(err: Error): boolean {
  return err instanceof SyntaxError && 'body' in err;
}

function prismaErrorCode(err: Error): string | undefined {
  if (!('code' in err) || typeof (err as { code?: unknown }).code !== 'string') {
    return undefined;
  }
  const name = err.name || err.constructor?.name;
  if (name !== 'PrismaClientKnownRequestError') return undefined;
  return (err as { code: string }).code;
}

function mapPrismaError(err: Error): AppError | undefined {
  const code = prismaErrorCode(err);
  if (code === 'P2002') {
    return new ConflictError('Resource already exists');
  }
  if (code === 'P2025') {
    return new NotFoundError('Record not found');
  }
  if (code === 'P2003') {
    return new ValidationError('Related record not found');
  }
  if ((err.name || err.constructor?.name) === 'PrismaClientValidationError') {
    return new ValidationError('Invalid data');
  }
  return undefined;
}

function normalizeError(err: Error): {
  statusCode: number;
  message: string;
  code: string;
  details?: unknown;
  logName: string;
  original: Error;
  mappedFrom?: string;
} {
  if (err instanceof ZodError) {
    const firstIssue = err.errors[0];
    const summary = firstIssue
      ? `${firstIssue.path.join('.') || 'field'}: ${firstIssue.message}`
      : 'Validation failed';
    return {
      statusCode: 400,
      message: summary,
      code: 'VALIDATION_ERROR',
      details: err.errors.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
      logName: 'ZodError',
      original: err,
    };
  }

  if (isJsonBodyError(err)) {
    return {
      statusCode: 400,
      message: 'Invalid JSON body',
      code: 'INVALID_JSON',
      logName: 'SyntaxError',
      original: err,
    };
  }

  const prismaMapped = mapPrismaError(err);
  if (prismaMapped) {
    return {
      statusCode: prismaMapped.statusCode,
      message: prismaMapped.message,
      code: prismaMapped.code ?? 'INTERNAL_ERROR',
      logName: err.name,
      original: err,
      mappedFrom: prismaErrorCode(err) ?? err.name,
    };
  }

  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      message: err.message,
      code: err.code ?? 'APP_ERROR',
      details:
        err instanceof WhatsAppDeliveryError && err.details ? err.details : undefined,
      logName: err.name,
      original: err,
    };
  }

  return {
    statusCode: 500,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
    logName: err.name || 'Error',
    original: err,
  };
}

function logResolvedError(
  req: Request,
  resolved: ReturnType<typeof normalizeError>
): void {
  const path = requestPath(req);
  const method = req.method;
  const meta: Record<string, unknown> = {
    requestId: req.requestId,
    method,
    path,
    statusCode: resolved.statusCode,
    code: resolved.code,
    at: extractAppFrame(resolved.original.stack),
    userId: req.user?.userId,
    businessId: req.user?.businessId,
  };
  if (resolved.mappedFrom) {
    meta.mappedFrom = resolved.mappedFrom;
  }

  const message = `[${method} ${path}] ${resolved.logName}: ${resolved.original.message}`;
  const isServerError = resolved.statusCode >= 500;
  const isNoisy404 =
    resolved.code === 'ROUTE_NOT_FOUND' &&
    (isNoisyRoute(path) || !path.startsWith('/api/'));

  if (isServerError) {
    logger.error(message, { ...meta, stack: resolved.original.stack });
    return;
  }

  if (isNoisy404) {
    logger.debug(message, meta);
    return;
  }

  logger.warn(message, meta);
}

function sendError(req: Request, res: Response, resolved: ReturnType<typeof normalizeError>): void {
  const body: ErrorBody = {
    success: false,
    error: resolved.message,
    code: resolved.code,
    requestId: req.requestId,
  };
  if (resolved.details !== undefined) {
    body.details = resolved.details;
  }
  if (config.env !== 'production' && resolved.statusCode >= 500) {
    body.stack = resolved.original.stack;
  }
  res.status(resolved.statusCode).json(body);
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const resolved = normalizeError(err);
  logResolvedError(req, resolved);

  if (res.headersSent) {
    next(err);
    return;
  }

  sendError(req, res, resolved);
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new RouteNotFoundError(req.method, requestPath(req)));
}
