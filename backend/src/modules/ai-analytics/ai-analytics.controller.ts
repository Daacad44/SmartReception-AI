import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { aiAnalyticsService } from './ai-analytics.service';
import { routeParam } from '../../core/utils';

const filtersSchema = z.object({
  customerId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  provider: z.string().optional(),
  channel: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

function parseFilters(query: Request['query']) {
  const parsed = filtersSchema.safeParse(query);
  if (!parsed.success) return {};
  return {
    ...parsed.data,
    from: parsed.data.from ? new Date(parsed.data.from) : undefined,
    to: parsed.data.to ? new Date(parsed.data.to) : undefined,
  };
}

export class AiAnalyticsController {
  async businessDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await aiAnalyticsService.getBusinessDashboard(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async businessDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await aiAnalyticsService.getBusinessDetailAnalytics(
        req.user!.businessId!,
        parseFilters(req.query)
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async platformDashboard(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await aiAnalyticsService.getPlatformDashboard();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async superAdminBusinesses(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 50);
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const data = await aiAnalyticsService.listSuperAdminBusinessCards(page, limit, search);
      res.json({ success: true, data: data.data, meta: data.meta });
    } catch (error) {
      next(error);
    }
  }

  async superAdminBusinessDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await aiAnalyticsService.getBusinessDetailAnalytics(
        routeParam(req.params.businessId),
        parseFilters(req.query)
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async customerAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await aiAnalyticsService.getCustomerAnalytics(
        req.user!.businessId!,
        routeParam(req.params.customerId)
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async conversationAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await aiAnalyticsService.getConversationAnalytics(
        req.user!.businessId!,
        routeParam(req.params.conversationId)
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async backfill(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId =
        typeof req.body?.businessId === 'string' ? req.body.businessId : undefined;
      const data = await aiAnalyticsService.runBackfill(businessId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const aiAnalyticsController = new AiAnalyticsController();
