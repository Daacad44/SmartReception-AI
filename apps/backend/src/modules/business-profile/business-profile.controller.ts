import { Request, Response, NextFunction } from 'express';
import { businessProfileService } from './business-profile.service';
import { updateBusinessProfileSchema } from '@smartreception/shared';

export class BusinessProfileController {
  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await businessProfileService.get(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateBusinessProfileSchema.parse(req.body);
      const data = await businessProfileService.update(req.user!.businessId!, input);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async uploadPdf(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'PDF file required' });
        return;
      }
      const data = await businessProfileService.uploadPdf(
        req.user!.businessId!,
        req.file.buffer,
        req.file.originalname
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async reprocessPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await businessProfileService.reprocessPdf(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async deletePdf(req: Request, res: Response, next: NextFunction) {
    try {
      await businessProfileService.deletePdf(req.user!.businessId!);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export const businessProfileController = new BusinessProfileController();
