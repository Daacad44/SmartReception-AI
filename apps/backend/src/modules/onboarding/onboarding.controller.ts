import { Request, Response, NextFunction } from 'express';
import { onboardingService } from './onboarding.service';
import {
  onboardingBusinessInfoSchema,
  onboardingProfileSchema,
  onboardingDiscoverySchema,
  onboardingPlanSchema,
  onboardingWhatsAppSchema,
} from '@smartreception/shared';

export class OnboardingController {
  async status(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await onboardingService.getStatus(req.user!.userId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async businessInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const input = onboardingBusinessInfoSchema.parse(req.body);
      const result = await onboardingService.saveBusinessInfo(req.user!.userId, input);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async profile(req: Request, res: Response, next: NextFunction) {
    try {
      const input = onboardingProfileSchema.parse(req.body);
      const businessId = req.user!.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, error: 'Business context required' });
        return;
      }
      const data = await onboardingService.saveProfile(req.user!.userId, businessId, input);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async discovery(req: Request, res: Response, next: NextFunction) {
    try {
      const input = onboardingDiscoverySchema.parse(req.body);
      const businessId = req.user!.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, error: 'Business context required' });
        return;
      }
      const data = await onboardingService.saveDiscovery(req.user!.userId, businessId, input);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async plan(req: Request, res: Response, next: NextFunction) {
    try {
      const input = onboardingPlanSchema.parse(req.body);
      const businessId = req.user!.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, error: 'Business context required' });
        return;
      }
      const data = await onboardingService.savePlan(req.user!.userId, businessId, input);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async whatsapp(req: Request, res: Response, next: NextFunction) {
    try {
      const input = onboardingWhatsAppSchema.parse(req.body);
      const businessId = req.user!.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, error: 'Business context required' });
        return;
      }
      const data = await onboardingService.connectWhatsApp(req.user!.userId, businessId, input);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      if (!businessId) {
        res.status(400).json({ success: false, error: 'Business context required' });
        return;
      }
      const data = await onboardingService.complete(req.user!.userId, businessId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async welcomeSeen(req: Request, res: Response, next: NextFunction) {
    try {
      await onboardingService.markWelcomeSeen(req.user!.userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export const onboardingController = new OnboardingController();
