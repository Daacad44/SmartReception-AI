import { Request, Response, NextFunction } from 'express';
import { campaignsService } from './campaigns.service';
import { createCampaignSchema, updateCampaignSchema, paginationSchema } from '@smartreception/shared';
import { routeParam } from '../../core/utils';

export class CampaignsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const params = paginationSchema.parse(req.query);
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const result = await campaignsService.list(req.user!.businessId!, { ...params, status });
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await campaignsService.get(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createCampaignSchema.parse(req.body);
      const data = await campaignsService.create(req.user!.businessId!, input, req.user!.userId);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateCampaignSchema.parse(req.body);
      const data = await campaignsService.update(
        req.user!.businessId!,
        routeParam(req.params.id),
        input,
        req.user!.userId
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      await campaignsService.cancel(req.user!.businessId!, routeParam(req.params.id), req.user!.userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async sendNow(req: Request, res: Response, next: NextFunction) {
    try {
      await campaignsService.sendNow(req.user!.businessId!, routeParam(req.params.id), req.user!.userId);
      res.json({ success: true, message: 'Campaign is being sent' });
    } catch (error) {
      next(error);
    }
  }

  async analytics(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await campaignsService.getAnalytics(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const campaignsController = new CampaignsController();
