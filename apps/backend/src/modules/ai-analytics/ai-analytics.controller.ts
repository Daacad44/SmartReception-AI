import { Request, Response, NextFunction } from 'express';
import { aiAnalyticsService } from './ai-analytics.service';
import { routeParam } from '../../core/utils';

export class AiAnalyticsController {
  async businessDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await aiAnalyticsService.getBusinessDashboard(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async platformDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await aiAnalyticsService.getPlatformDashboard();
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
}

export const aiAnalyticsController = new AiAnalyticsController();
