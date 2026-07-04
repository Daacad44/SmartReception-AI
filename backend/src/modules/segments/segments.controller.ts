import { Request, Response, NextFunction } from 'express';
import { segmentsService } from './segments.service';
import { createSegmentSchema, updateSegmentSchema } from '@smartreception/shared';
import { routeParam } from '../../core/utils';
import { z } from 'zod';

export class SegmentsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await segmentsService.list(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await segmentsService.get(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createSegmentSchema.parse(req.body);
      const data = await segmentsService.create(req.user!.businessId!, input, req.user!.userId);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateSegmentSchema.parse(req.body);
      const data = await segmentsService.update(
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

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await segmentsService.delete(req.user!.businessId!, routeParam(req.params.id), req.user!.userId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async addMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const { customerIds } = z.object({ customerIds: z.array(z.string().uuid()) }).parse(req.body);
      await segmentsService.addMembers(
        req.user!.businessId!,
        routeParam(req.params.id),
        customerIds,
        req.user!.userId
      );
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export const segmentsController = new SegmentsController();
