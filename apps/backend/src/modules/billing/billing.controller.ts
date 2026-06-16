import { Request, Response, NextFunction } from 'express';
import { billingService } from './billing.service';

export class BillingController {
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await billingService.getBillingOverview(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const billingController = new BillingController();
