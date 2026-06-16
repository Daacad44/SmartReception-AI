import { Request, Response, NextFunction } from 'express';
import { analyticsService } from './analytics.service';
import { z } from 'zod';

const trendsQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(30),
});

export class AnalyticsController {
  async dashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await analyticsService.getDashboardStats(req.user!.businessId!);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async revenue(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await analyticsService.getRevenueOverview(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async customerGrowth(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await analyticsService.getCustomerGrowth(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async topServices(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await analyticsService.getTopServices(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async fullAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await analyticsService.getFullAnalytics(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async trends(req: Request, res: Response, next: NextFunction) {
    try {
      const { days } = trendsQuerySchema.parse(req.query);
      const trends = await analyticsService.getTrends(req.user!.businessId!, days);
      res.json({ success: true, data: trends });
    } catch (error) {
      next(error);
    }
  }

  async teamPerformance(req: Request, res: Response, next: NextFunction) {
    try {
      const performance = await analyticsService.getTeamPerformance(req.user!.businessId!);
      res.json({ success: true, data: performance });
    } catch (error) {
      next(error);
    }
  }
}

export const analyticsController = new AnalyticsController();
