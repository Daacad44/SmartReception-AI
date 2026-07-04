import { Request, Response, NextFunction } from 'express';
import { twoFactorService } from './two-factor.service';
import { twoFactorSetupVerifySchema, twoFactorDisableSchema } from '@smartreception/shared';

export class TwoFactorController {
  async setup(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await twoFactorService.setup(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async confirm(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = twoFactorSetupVerifySchema.parse(req.body);
      const result = await twoFactorService.confirmSetup(req.user!.userId, code);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async status(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await twoFactorService.getStatus(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async disable(req: Request, res: Response, next: NextFunction) {
    try {
      const { password, code } = twoFactorDisableSchema.parse(req.body);
      const result = await twoFactorService.disable(req.user!.userId, password, code);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const twoFactorController = new TwoFactorController();
