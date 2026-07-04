import type { Request, Response, NextFunction } from 'express';
import { trainerAuthService } from './trainer-auth.service';
import { UnauthorizedError } from '../../../core/errors';
import { prisma } from '../../../infrastructure/database/prisma';

export interface TrainerRequest extends Request {
  trainer?: {
    id: string;
    businessId?: string;
    permissions: Record<string, boolean>;
  };
}

export async function authenticateTrainer(req: TrainerRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.trainer_token;
    if (!token) {
      throw new UnauthorizedError('Authentication required');
    }

    const payload = trainerAuthService.verifyTrainerToken(token);
    const trainer = await prisma.aiTrainer.findUnique({
      where: { id: payload.trainerId },
      select: { id: true, isActive: true, permissions: true },
    });

    if (!trainer?.isActive) {
      throw new UnauthorizedError('Trainer account inactive');
    }

    const businessId =
      (req.headers['x-business-id'] as string) ||
      req.body?.businessId ||
      payload.businessId;

    if (businessId) {
      const assigned = await prisma.aiTrainerBusiness.findUnique({
        where: { trainerId_businessId: { trainerId: trainer.id, businessId } },
      });
      if (!assigned) {
        throw new UnauthorizedError('Business not assigned to trainer');
      }
    }

    req.trainer = {
      id: trainer.id,
      businessId,
      permissions: (trainer.permissions as Record<string, boolean>) ?? {},
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireTrainerPermission(...perms: string[]) {
  return (req: TrainerRequest, res: Response, next: NextFunction) => {
    if (!req.trainer) {
      return next(new UnauthorizedError('Trainer authentication required'));
    }
    const permissions = req.trainer.permissions;
    const hasAll = perms.every((p) => permissions[p] !== false);
    if (!hasAll && Object.keys(permissions).length > 0) {
      const allowed = perms.some((p) => permissions[p] === true);
      if (!allowed) {
        return next(new UnauthorizedError('Insufficient trainer permissions'));
      }
    }
    next();
  };
}

export function requireTrainerBusiness(req: TrainerRequest, res: Response, next: NextFunction) {
  if (!req.trainer?.businessId) {
    return next(new UnauthorizedError('Business selection required'));
  }
  next();
}
