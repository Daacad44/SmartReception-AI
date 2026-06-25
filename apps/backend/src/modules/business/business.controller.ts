import { Request, Response, NextFunction } from 'express';
import { businessService } from './business.service';
import { updateBusinessSchema } from '@smartreception/shared';
import { z } from 'zod';

const updateSettingsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  timezone: z.string().optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().url().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
});

export class BusinessController {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const business = await businessService.getBusiness(req.user!.businessId!);
      res.json({ success: true, data: business });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateBusinessSchema.parse(req.body);
      const business = await businessService.updateBusiness(
        req.user!.businessId!,
        input,
        req.user!.userId
      );
      res.json({ success: true, data: business });
    } catch (error) {
      next(error);
    }
  }

  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await businessService.getSettings(req.user!.businessId!);
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateSettingsSchema.parse(req.body);
      const settings = await businessService.updateSettings(
        req.user!.businessId!,
        input,
        req.user!.userId
      );
      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }
}

export const businessController = new BusinessController();
