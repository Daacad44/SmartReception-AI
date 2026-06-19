import { Request, Response, NextFunction } from 'express';
import { billingService } from './billing.service';
import { changePlanSchema } from '@smartreception/shared';

export class BillingController {
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await billingService.getBillingOverview(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async changePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const input = changePlanSchema.parse(req.body);
      const data = await billingService.changePlan(
        req.user!.businessId!,
        input,
        req.user!.userId
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const billingController = new BillingController();
