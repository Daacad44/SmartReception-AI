import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { UnauthorizedError, AppError } from '../errors';
import { JwtPayload } from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload & { permissions: string[] };
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];
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
    const permissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || [];

    req.user = {
      ...decoded,
      role: membership?.role,
      permissions: [...permissions],
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
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }
  authenticate(req, _res, next).catch(next);
}
