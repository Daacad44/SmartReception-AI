import { Request, Response, NextFunction } from 'express';
import { validateBusinessLicense } from '../../modules/subscription/subscription-license.service';

/**
 * Blocks tenant API access when subscription license is invalid.
 * Super admins and impersonation bypass license checks.
 */
export function requireValidLicense() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.businessId) {
      next();
      return;
    }

    if (req.user.impersonating || req.user.permissions.includes('platform:admin')) {
      next();
      return;
    }

    const { prisma } = await import('../../infrastructure/database/prisma');
    const business = await prisma.business.findUnique({
      where: { id: req.user.businessId },
      select: { onboardingCompletedAt: true },
    });
    if (!business?.onboardingCompletedAt) {
      next();
      return;
    }

    const result = await validateBusinessLicense(req.user.businessId);
    if (!result.valid) {
      const { SubscriptionExpiredError } = await import('../errors');
      next(new SubscriptionExpiredError(result.reason ?? 'Subscription expired'));
      return;
    }

    next();
  };
}
