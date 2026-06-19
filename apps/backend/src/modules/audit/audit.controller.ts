import { Request, Response, NextFunction } from 'express';
import { auditService } from './audit.service';
import { paginationSchema } from '@smartreception/shared';
import { ForbiddenError } from '../../core/errors';

const AUDIT_ROLES = new Set(['OWNER', 'ADMIN']);

export class AuditController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!AUDIT_ROLES.has(req.user!.role ?? '')) {
        throw new ForbiddenError('Only owners and admins can view audit logs');
      }

      const params = paginationSchema.parse(req.query);
      const entity = req.query.entity as string | undefined;
      const action = req.query.action as string | undefined;
      const result = await auditService.list(req.user!.businessId!, {
        ...params,
        entity,
        action,
      });
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
