import { Request, Response, NextFunction } from 'express';
import { aiTrainingService } from './ai-training.service';

export class AiTrainingController {
  async overview(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await aiTrainingService.getOverview(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async reindex(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await aiTrainingService.reindex(
        req.user!.businessId!,
        req.user!.userId,
        req.user!.isSuperAdmin ?? false
      );
      if (result.approvalRequired) {
        res.status(202).json({
          success: true,
          approvalRequired: true,
          message: 'Administrator approval required',
          data: result.request,
        });
        return;
      }
      res.json({ success: true, data: { reindexed: result.reindexed } });
    } catch (error) {
      next(error);
    }
  }

  async resetMemory(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await aiTrainingService.resetMemory(
        req.user!.businessId!,
        req.user!.userId,
        req.user!.isSuperAdmin ?? false
      );
      if (result.approvalRequired) {
        res.status(202).json({
          success: true,
          approvalRequired: true,
          message: 'Administrator approval required',
          data: result.request,
        });
        return;
      }
      res.json({ success: true, data: { affected: result.affected } });
    } catch (error) {
      next(error);
    }
  }
}

export const aiTrainingController = new AiTrainingController();
