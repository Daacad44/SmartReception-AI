import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from './subscription.service';
import type { BusinessLicenseStatus, SubscriptionDurationPreset, SubscriptionPlan } from '@prisma/client';

function businessIdFromReq(req: Request): string {
  const id = req.params.businessId;
  return Array.isArray(id) ? id[0]! : id;
}

function actorFromReq(req: Request) {
  return {
    userId: req.user!.userId,
    email: req.user!.email,
    ipAddress: req.ip,
  };
}

export class SubscriptionAdminController {
  async listPlans(_req: Request, res: Response, next: NextFunction) {
    try {
      const plans = await subscriptionService.listPlans();
      res.json({ data: plans });
    } catch (error) {
      next(error);
    }
  }

  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, Number(_req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(_req.query.limit) || 20));
      const search = typeof _req.query.search === 'string' ? _req.query.search : undefined;
      const status = _req.query.status as BusinessLicenseStatus | undefined;
      const planCode = _req.query.plan as SubscriptionPlan | undefined;
      const result = await subscriptionService.listAdminSubscriptions({
        page,
        limit,
        search,
        status,
        planCode,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subscriptionService.getAdminBusinessDetail(businessIdFromReq(req));
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async assign(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subscriptionService.assignSubscription(
        {
          businessId: businessIdFromReq(req),
          planCode: req.body.planCode,
          durationPreset: req.body.durationPreset as SubscriptionDurationPreset,
          customDurationDays: req.body.customDurationDays,
          activationDate: req.body.activationDate
            ? new Date(req.body.activationDate)
            : undefined,
          internalNotes: req.body.internalNotes,
          paymentStatus: req.body.paymentStatus,
        },
        actorFromReq(req)
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async extend(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subscriptionService.extendSubscription(
        businessIdFromReq(req),
        Number(req.body.additionalDays),
        actorFromReq(req),
        req.body.reason
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async shorten(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subscriptionService.shortenSubscription(
        businessIdFromReq(req),
        Number(req.body.reduceDays),
        actorFromReq(req),
        req.body.reason
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async suspend(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subscriptionService.setStatus(
        businessIdFromReq(req),
        'SUSPENDED',
        actorFromReq(req),
        'SUSPENDED',
        req.body.reason
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async reactivate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subscriptionService.setStatus(
        businessIdFromReq(req),
        'ACTIVE',
        actorFromReq(req),
        'REACTIVATED',
        req.body.reason
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async pause(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subscriptionService.setStatus(
        businessIdFromReq(req),
        'SUSPENDED',
        actorFromReq(req),
        'SUSPENDED',
        req.body.reason ?? 'Paused by super admin'
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async resume(req: Request, res: Response, next: NextFunction) {
    return this.reactivate(req, res, next);
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subscriptionService.setStatus(
        businessIdFromReq(req),
        'CANCELLED',
        actorFromReq(req),
        'CANCELLED',
        req.body.reason
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async unlock(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subscriptionService.setStatus(
        businessIdFromReq(req),
        'ACTIVE',
        actorFromReq(req),
        'UNLOCKED',
        req.body.reason ?? 'Temporary unlock by super admin'
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async upgrade(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subscriptionService.changePlan(
        businessIdFromReq(req),
        req.body.planCode,
        actorFromReq(req),
        'UPGRADED',
        req.body.reason
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async downgrade(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subscriptionService.changePlan(
        businessIdFromReq(req),
        req.body.planCode,
        actorFromReq(req),
        'DOWNGRADED',
        req.body.reason
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async addNote(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await subscriptionService.addNote(
        businessIdFromReq(req),
        req.body.note,
        actorFromReq(req)
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

export class SubscriptionController {
  async status(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await subscriptionService.getTenantLicenseStatus(req.user!.businessId!);
      res.json({ data });
    } catch (error) {
      next(error);
    }
  }
}

export const subscriptionAdminController = new SubscriptionAdminController();
export const subscriptionController = new SubscriptionController();
