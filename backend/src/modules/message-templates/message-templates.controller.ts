import { Request, Response, NextFunction } from 'express';
import { messageTemplatesService } from './message-templates.service';
import { createMessageTemplateSchema, updateMessageTemplateSchema } from '@smartreception/shared';
import { routeParam } from '../../core/utils';

export class MessageTemplatesController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await messageTemplatesService.list(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await messageTemplatesService.get(req.user!.businessId!, routeParam(req.params.id));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createMessageTemplateSchema.parse(req.body);
      const data = await messageTemplatesService.create(req.user!.businessId!, input, req.user!.userId);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const input = updateMessageTemplateSchema.parse(req.body);
      const data = await messageTemplatesService.update(
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
      await messageTemplatesService.delete(
        req.user!.businessId!,
        routeParam(req.params.id),
        req.user!.userId
      );
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export const messageTemplatesController = new MessageTemplatesController();
