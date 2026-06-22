import { Request, Response, NextFunction } from 'express';
import { superAdminService } from './super-admin.service';
import { paginationSchema } from '@smartreception/shared';
import { routeParam } from '../../core/utils';
import { z } from 'zod';

export class SuperAdminController {
  async stats(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await superAdminService.getPlatformStats();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async businesses(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = paginationSchema.parse(req.query);
      const result = await superAdminService.listBusinesses(page, limit);
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async users(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = paginationSchema.parse(req.query);
      const result = await superAdminService.listUsers(page, limit);
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async toggleBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
      const business = await superAdminService.toggleBusinessActive(routeParam(req.params.id), isActive);
      res.json({ success: true, data: business });
    } catch (error) {
      next(error);
    }
  }
}

export const superAdminController = new SuperAdminController();
