import { Request, Response, NextFunction } from 'express';
import { routeParam } from '../../core/utils';
import { conversationsService } from './conversations.service';
import { paginationSchema, sendMessageSchema } from '@smartreception/shared';

export class ConversationsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const params = paginationSchema.parse(req.query);
      const status = req.query.status as string | undefined;
      const assignedToId = req.query.assignedToId as string | undefined;
      const result = await conversationsService.list(req.user!.businessId!, {
        ...params,
        status,
        assignedToId,
      });
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const conversation = await conversationsService.get(
        req.user!.businessId!,
        routeParam(req.params.id)
      );
      res.json({ success: true, data: conversation });
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const input = sendMessageSchema.parse(req.body);
      const message = await conversationsService.sendMessage(
        req.user!.businessId!,
        routeParam(req.params.id),
        input,
        req.user!.userId
      );
      res.status(201).json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  }

  async takeover(req: Request, res: Response, next: NextFunction) {
    try {
      const conversation = await conversationsService.takeover(
        req.user!.businessId!,
        routeParam(req.params.id),
        req.user!.userId
      );
      res.json({ success: true, data: conversation });
    } catch (error) {
      next(error);
    }
  }

  async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const messages = await conversationsService.getMessages(
        req.user!.businessId!,
        routeParam(req.params.id)
      );
      res.json({ success: true, data: messages });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const conversation = await conversationsService.markAsRead(
        req.user!.businessId!,
        routeParam(req.params.id)
      );
      res.json({ success: true, data: conversation });
    } catch (error) {
      next(error);
    }
  }
}

export const conversationsController = new ConversationsController();
