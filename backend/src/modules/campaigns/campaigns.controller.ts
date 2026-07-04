import { Request, Response, NextFunction } from 'express';
import { campaignsService } from './campaigns.service';
import { generateCampaignWithAi } from './campaign-ai-generator.service';
import {
  createCampaignSchema,
  updateCampaignSchema,
  paginationSchema,
  testCampaignSchema,
  generateCampaignAiSchema,
} from '@smartreception/shared';
import { routeParam } from '../../core/utils';

export class CampaignsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const params = paginationSchema.parse(req.query);
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const from = typeof req.query.from === 'string' ? req.query.from : undefined;
      const to = typeof req.query.to === 'string' ? req.query.to : undefined;
      const result = await campaignsService.list(req.user!.businessId!, { ...params, status, from, to });
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async calendar(req: Request, res: Response, next: NextFunction) {
    try {
      const from = typeof req.query.from === 'string' ? req.query.from : new Date().toISOString();
      const to =
        typeof req.query.to === 'string'
          ? req.query.to
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const data = await campaignsService.getCalendar(req.user!.businessId!, from, to);
      res.json({ success: true, data });
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

  async pause(req: Request, res: Response, next: NextFunction) {
    try {
      await campaignsService.pause(req.user!.businessId!, routeParam(req.params.id), req.user!.userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async resume(req: Request, res: Response, next: NextFunction) {
    try {
      await campaignsService.resume(req.user!.businessId!, routeParam(req.params.id), req.user!.userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async duplicate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await campaignsService.duplicate(
        req.user!.businessId!,
        routeParam(req.params.id),
        req.user!.userId
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async archive(req: Request, res: Response, next: NextFunction) {
    try {
      await campaignsService.archive(req.user!.businessId!, routeParam(req.params.id), req.user!.userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async testSend(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone } = testCampaignSchema.parse(req.body);
      const data = await campaignsService.testSend(
        req.user!.businessId!,
        routeParam(req.params.id),
        phone,
        req.user!.userId
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async generateAi(req: Request, res: Response, next: NextFunction) {
    try {
      const input = generateCampaignAiSchema.parse(req.body);
      const data = await generateCampaignWithAi(req.user!.businessId!, input);
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

  async deliveries(req: Request, res: Response, next: NextFunction) {
    try {
      const params = paginationSchema.parse(req.query);
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const deliveryTab =
        typeof req.query.deliveryTab === 'string' ? req.query.deliveryTab : undefined;
      const result = await campaignsService.listDeliveries(req.user!.businessId!, {
        ...params,
        status,
        deliveryTab,
      });
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }
}

export const campaignsController = new CampaignsController();
