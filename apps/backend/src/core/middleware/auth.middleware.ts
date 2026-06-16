import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { UnauthorizedError } from '../errors';
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
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

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

    const { ROLE_PERMISSIONS } = await import('@smartreception/shared');
    const role = membership?.role || 'VIEWER';
    const permissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || [];

    req.user = {
      ...decoded,
      role: membership?.role,
      permissions: [...permissions],
    };

    next();
  } catch {
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
