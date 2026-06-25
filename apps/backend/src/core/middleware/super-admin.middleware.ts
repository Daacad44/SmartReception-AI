import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database/prisma';
import { ForbiddenError } from '../../core/errors';

export async function requireSuperAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { isSuperAdmin: true },
    });
    if (!user?.isSuperAdmin) {
      throw new ForbiddenError('Super Admin access required');
    }
    next();
  } catch (error) {
    next(error);
  }
}
