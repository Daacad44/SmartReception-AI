import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../errors';

export function authorize(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ForbiddenError('Authentication required'));
      return;
    }

    const hasPermission = requiredPermissions.every((perm) =>
      req.user!.permissions.includes(perm)
    );

    if (!hasPermission) {
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }

    next();
  };
}

export function requireBusiness(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.businessId) {
    next(new ForbiddenError('Business context required'));
    return;
  }
  next();
}

export function tenantScope(businessIdParam = 'businessId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const paramBusinessId = req.params[businessIdParam] || req.body?.businessId;
    if (paramBusinessId && paramBusinessId !== req.user?.businessId) {
      next(new ForbiddenError('Access denied to this business'));
      return;
    }
    next();
  };
}
