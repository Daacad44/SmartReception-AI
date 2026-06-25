import { Request, Response, NextFunction } from 'express';
import { billingService } from './billing.service';
import { changePlanSchema, checkoutSchema } from '@smartreception/shared';
import { stripeService } from '../../infrastructure/stripe/stripe.service';
import { logger } from '../../core/logger';

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

  async createCheckout(req: Request, res: Response, next: NextFunction) {
    try {
      const { plan } = checkoutSchema.parse(req.body);
      const data = await billingService.createCheckoutSession(
        req.user!.businessId!,
        plan,
        req.user!.email
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createPortal(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await billingService.createPortalSession(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
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
