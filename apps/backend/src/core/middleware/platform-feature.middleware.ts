import { Request, Response, NextFunction } from 'express';
import { featureRegistryService } from '../../modules/feature-management/feature-registry.service';
import { ForbiddenError } from '../errors';

export function requirePlatformFeature(featureKey: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const businessId = req.user?.businessId;
      const enabled = await featureRegistryService.isFeatureEnabled(featureKey, businessId);

      if (!enabled) {
        throw new ForbiddenError(`Feature "${featureKey}" is disabled`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function assertFeatureEnabled(featureKey: string, businessId?: string): Promise<boolean> {
  return featureRegistryService.isFeatureEnabled(featureKey, businessId);
}
