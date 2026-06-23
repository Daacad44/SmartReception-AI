import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { UnauthorizedError, AppError } from '../errors';
import { JwtPayload } from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';
import { getAccessTokenFromCookies } from '../auth-cookies';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { permissions: string[] };
    }
  }
}

function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
}

function extractTokens(req: Request): { bearer: string | null; cookie: string | null } {
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  const cookie = getAccessTokenFromCookies(req.cookies as Record<string, string | undefined>) ?? null;
  return { bearer, cookie };
}

function resolveDecodedToken(bearer: string | null, cookie: string | null): JwtPayload {
  if (bearer) {
    try {
      return verifyAccessToken(bearer);
    } catch {
      if (cookie) {
        try {
          return verifyAccessToken(cookie);
        } catch {
          throw new UnauthorizedError('Invalid or expired token');
        }
      }
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  if (cookie) {
    try {
      return verifyAccessToken(cookie);
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  throw new UnauthorizedError('No token provided');
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { bearer, cookie } = extractTokens(req);
    const decoded = resolveDecodedToken(bearer, cookie);

    const [membership, user] = await Promise.all([
      decoded.businessId
        ? prisma.businessMember.findUnique({
            where: {
              businessId_userId: {
                businessId: decoded.businessId,
                userId: decoded.userId,
              },
            },
          })
        : Promise.resolve(null),
      prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { isSuperAdmin: true },
      }),
    ]);

    if (decoded.businessId && membership && !membership.isActive) {
      throw new UnauthorizedError('Your account has been deactivated for this business');
    }

    const { ROLE_PERMISSIONS } = await import('@smartreception/shared');
    const role = membership?.role || 'VIEWER';
    let permissions = [...(ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || [])];

    if (user?.isSuperAdmin) {
      permissions.push('platform:admin' as typeof permissions[number]);
    }

    req.user = {
      ...decoded,
      role: membership?.role,
      permissions,
      isSuperAdmin: user?.isSuperAdmin,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
      return;
    }
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const { bearer, cookie } = extractTokens(req);
  if (!bearer && !cookie) {
    next();
    return;
  }
  authenticate(req, _res, next).catch(next);
}
