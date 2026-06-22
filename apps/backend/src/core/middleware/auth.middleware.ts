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

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  const cookieToken = getAccessTokenFromCookies(req.cookies as Record<string, string | undefined>);
  return cookieToken ?? null;
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }

    const membership = decoded.businessId
      ? await prisma.businessMember.findUnique({
          where: {
            businessId_userId: {
              businessId: decoded.businessId,
              userId: decoded.userId,
            },
          },
        })
      : null;

    if (decoded.businessId && membership && !membership.isActive) {
      throw new UnauthorizedError('Your account has been deactivated for this business');
    }

    const { ROLE_PERMISSIONS } = await import('@smartreception/shared');
    const role = membership?.role || 'VIEWER';
    let permissions = [...(ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || [])];

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { isSuperAdmin: true },
    });
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
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }
  authenticate(req, _res, next).catch(next);
}
