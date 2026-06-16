import { Request, Response, NextFunction } from 'express';
import { routeParam } from '../../core/utils';
import { servicesService } from './services.service';
import { createServiceSchema, paginationSchema } from '@smartreception/shared';

export class ServicesController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const params = paginationSchema.parse(req.query);
      const result = await servicesService.list(req.user!.businessId!, params);
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const service = await servicesService.get(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true, data: service });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createServiceSchema.parse(req.body);
      const service = await servicesService.create(
        req.user!.businessId!,
        input,
        req.user!.userId
      );
      res.status(201).json({ success: true, data: service });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createServiceSchema.partial().parse(req.body);
      const service = await servicesService.update(
        req.user!.businessId!,
        routeParam(req.params.id),
        input,
        req.user!.userId
      );
      res.json({ success: true, data: service });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await servicesService.delete(req.user!.businessId!, routeParam(req.params.id), req.user!.userId);
      res.json({ success: true, message: 'Service deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const servicesController = new ServicesController();
