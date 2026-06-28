import { Request, Response, NextFunction } from 'express';
import { onboardingService } from './onboarding.service';
import {
  onboardingBusinessInfoSchema,
  onboardingDescriptionSchema,
  onboardingServicesSchema,
  onboardingWorkingHoursSchema,
  onboardingLanguagesSchema,
  onboardingWhatsAppSchema,
} from '@smartreception/shared';
import { authRepository } from '../auth/auth.repository';

async function resolveBusinessId(req: Request): Promise<string | null> {
  if (req.user?.businessId) return req.user.businessId;
  const memberships = await authRepository.getUserBusinesses(req.user!.userId);
  return memberships[0]?.businessId ?? null;
}

export class OnboardingController {
  async businessTypes(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await onboardingService.listBusinessTypes();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async status(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await onboardingService.getStatus(req.user!.userId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async welcome(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await onboardingService.advanceWelcome(req.user!.userId);
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

  async description(req: Request, res: Response, next: NextFunction) {
    try {
      const input = onboardingDescriptionSchema.parse(req.body);
      const businessId = await resolveBusinessId(req);
      if (!businessId) {
        res.status(400).json({ success: false, error: 'Ganacsi lama helin' });
        return;
      }
      const data = await onboardingService.saveDescription(req.user!.userId, businessId, input);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async services(req: Request, res: Response, next: NextFunction) {
    try {
      const input = onboardingServicesSchema.parse(req.body);
      const businessId = await resolveBusinessId(req);
      if (!businessId) {
        res.status(400).json({ success: false, error: 'Ganacsi lama helin' });
        return;
      }
      const data = await onboardingService.saveServices(req.user!.userId, businessId, input);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async workingHours(req: Request, res: Response, next: NextFunction) {
    try {
      const input = onboardingWorkingHoursSchema.parse(req.body);
      const businessId = await resolveBusinessId(req);
      if (!businessId) {
        res.status(400).json({ success: false, error: 'Ganacsi lama helin' });
        return;
      }
      const data = await onboardingService.saveWorkingHours(req.user!.userId, businessId, input);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async languages(req: Request, res: Response, next: NextFunction) {
    try {
      const input = onboardingLanguagesSchema.parse(req.body);
      const businessId = await resolveBusinessId(req);
      if (!businessId) {
        res.status(400).json({ success: false, error: 'Ganacsi lama helin' });
        return;
      }
      const data = await onboardingService.saveLanguages(req.user!.userId, businessId, input);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async whatsapp(req: Request, res: Response, next: NextFunction) {
    try {
      const input = onboardingWhatsAppSchema.parse(req.body);
      const businessId = await resolveBusinessId(req);
      if (!businessId) {
        res.status(400).json({ success: false, error: 'Ganacsi lama helin' });
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
      const businessId = await resolveBusinessId(req);
      if (!businessId) {
        res.status(400).json({ success: false, error: 'Ganacsi lama helin' });
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
