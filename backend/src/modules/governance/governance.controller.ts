import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { routeParam } from '../../core/utils';
import { governanceService, buildGovernanceContext } from './governance.service';

const activateSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
});

export class GovernanceController {
  async capabilities(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await governanceService.getCapabilities(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async listRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await governanceService.listBusinessRequests(
        req.user!.businessId!,
        req.user!.userId
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await governanceService.getRequest(
        req.user!.businessId!,
        routeParam(req.params.id),
        req.user!.userId
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async activate(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = activateSchema.parse(req.body);
      const ctx = buildGovernanceContext(req);
      const data = await governanceService.activateRequest(
        ctx.businessId,
        routeParam(req.params.id),
        ctx.userId,
        code,
        ctx
      );
      res.json({ success: true, data, message: 'Action executed successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const governanceController = new GovernanceController();

export class SuperAdminGovernanceController {
  async listRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 25;
      const status = req.query.status as string | undefined;
      const businessId = req.query.businessId as string | undefined;
      const data = await governanceService.listAllRequests({
        page,
        limit,
        status,
        businessId,
      });
      res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await governanceService.approveRequest(
        routeParam(req.params.id),
        req.user!.userId,
        {
          ipAddress: req.ip,
          userAgent:
            typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
        }
      );
      res.json({ success: true, data, message: 'Request approved. Activation code sent to requester.' });
    } catch (error) {
      next(error);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
      const data = await governanceService.rejectRequest(
        routeParam(req.params.id),
        req.user!.userId,
        reason,
        {
          ipAddress: req.ip,
          userAgent:
            typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
        }
      );
      res.json({ success: true, data, message: 'Request rejected' });
    } catch (error) {
      next(error);
    }
  }
}

export const superAdminGovernanceController = new SuperAdminGovernanceController();
