import { Request, Response, NextFunction } from 'express';
import { aiService } from './ai.service';
import { aiConfigSchema } from '@smartreception/shared';

export class AIController {
  async getConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await aiService.getConfig(req.user!.businessId!);
      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  async updateConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const input = aiConfigSchema.parse(req.body);
      const config = await aiService.updateConfig(
        req.user!.businessId!,
        input,
        req.user!.userId
      );
      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }
}

export const aiController = new AIController();
