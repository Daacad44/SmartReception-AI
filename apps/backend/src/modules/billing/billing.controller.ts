import { Request, Response, NextFunction } from 'express';
import { billingService } from './billing.service';
import { stripeService } from '../../infrastructure/stripe/stripe.service';
import { logger } from '../../core/logger';
import { subscriptionService } from '../subscription/subscription.service';
import { ForbiddenError } from '../../core/errors';

export class BillingController {
  async getLicenseStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await subscriptionService.getTenantLicenseStatus(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await billingService.getBillingOverview(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async changePlan(_req: Request, _res: Response, next: NextFunction) {
    next(
      new ForbiddenError(
        'Plan changes are managed by SmartReception support. Please contact your administrator.'
      )
    );
  }

  async createCheckout(_req: Request, _res: Response, next: NextFunction) {
    next(
      new ForbiddenError(
        'Self-service checkout is not available yet. Please contact SmartReception support.'
      )
    );
  }

  async createPortal(_req: Request, _res: Response, next: NextFunction) {
    next(
      new ForbiddenError(
        'Billing portal is not available yet. Please contact SmartReception support.'
      )
    );
  }

  async webhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;

      if (!signature || !rawBody) {
        res.status(400).json({ success: false, error: 'Missing signature or body' });
        return;
      }

      const event = stripeService.constructWebhookEvent(rawBody, signature);
      await billingService.handleStripeWebhook(event);
      res.json({ received: true });
    } catch (error) {
      logger.error('Stripe webhook error:', error);
      next(error);
    }
  }
}

export const billingController = new BillingController();
