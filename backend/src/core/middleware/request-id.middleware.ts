import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

const INCOMING_REQUEST_ID = /^[\w.:-]{1,128}$/;

export function resolveRequestId(incoming: string | undefined): string {
  const trimmed = incoming?.trim();
  if (trimmed && INCOMING_REQUEST_ID.test(trimmed)) {
    return trimmed;
  }
  return randomUUID();
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = resolveRequestId(req.header('x-request-id'));
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
