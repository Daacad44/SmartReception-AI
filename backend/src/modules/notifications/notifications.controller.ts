import { Request, Response, NextFunction } from 'express';
import { notificationsService } from './notifications.service';
import { routeParam } from '../../core/utils';

export class NotificationsController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const notifications = await notificationsService.list(
        req.user!.businessId!,
        req.user!.userId
      );
      res.json({ success: true, data: notifications });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const notification = await notificationsService.markAsRead(
        req.user!.businessId!,
        req.user!.userId,
        routeParam(req.params.id)
      );
      res.json({ success: true, data: notification });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await notificationsService.markAllAsRead(
        req.user!.businessId!,
        req.user!.userId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationsController = new NotificationsController();
