import { Request, Response, NextFunction } from 'express';
import { routeParam } from '../../core/utils';
import { conversationsService } from './conversations.service';
import { paginationSchema, sendMessageSchema, conversationAssignSchema, conversationTransferSchema } from '@smartreception/shared';

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

  async summary(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await conversationsService.getSummary(req.user!.businessId!);
      res.json({ success: true, data });
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

  async listTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await conversationsService.listTemplates(req.user!.businessId!);
      res.json({ success: true, data });
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

  async transferToAi(req: Request, res: Response, next: NextFunction) {
    try {
      const conversation = await conversationsService.transferToAi(
        req.user!.businessId!,
        routeParam(req.params.id),
        req.user!.userId
      );
      res.json({ success: true, data: conversation });
    } catch (error) {
      next(error);
    }
  }

  async handoffToHuman(req: Request, res: Response, next: NextFunction) {
    try {
      const conversation = await conversationsService.handoffToHuman(
        req.user!.businessId!,
        routeParam(req.params.id),
        req.user!.userId
      );
      res.json({ success: true, data: conversation });
    } catch (error) {
      next(error);
    }
  }

  async sendTyping(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await conversationsService.sendTypingIndicator(
        req.user!.businessId!,
        routeParam(req.params.id)
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async assign(req: Request, res: Response, next: NextFunction) {
    try {
      const input = conversationAssignSchema.parse(req.body);
      const conversation = await conversationsService.assign(
        req.user!.businessId!,
        routeParam(req.params.id),
        input.assigneeId,
        req.user!.userId,
        input.team
      );
      res.json({ success: true, data: conversation });
    } catch (error) {
      next(error);
    }
  }

  async transfer(req: Request, res: Response, next: NextFunction) {
    try {
      const input = conversationTransferSchema.parse(req.body);
      const conversation = await conversationsService.transfer(
        req.user!.businessId!,
        routeParam(req.params.id),
        req.user!.userId,
        input.assigneeId,
        input.team
      );
      res.json({ success: true, data: conversation });
    } catch (error) {
      next(error);
    }
  }

  async resolve(req: Request, res: Response, next: NextFunction) {
    try {
      const conversation = await conversationsService.resolve(
        req.user!.businessId!,
        routeParam(req.params.id),
        req.user!.userId
      );
      res.json({ success: true, data: conversation });
    } catch (error) {
      next(error);
    }
  }

  async close(req: Request, res: Response, next: NextFunction) {
    try {
      const conversation = await conversationsService.close(
        req.user!.businessId!,
        routeParam(req.params.id),
        req.user!.userId
      );
      res.json({ success: true, data: conversation });
    } catch (error) {
      next(error);
    }
  }

  async requestHuman(req: Request, res: Response, next: NextFunction) {
    try {
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
      const conversation = await conversationsService.requestHuman(
        req.user!.businessId!,
        routeParam(req.params.id),
        req.user!.userId,
        reason
      );
      res.json({ success: true, data: conversation });
    } catch (error) {
      next(error);
    }
  }

  async getActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const activities = await conversationsService.getActivity(
        req.user!.businessId!,
        routeParam(req.params.id)
      );
      res.json({ success: true, data: activities });
    } catch (error) {
      next(error);
    }
  }

  async getFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const feedback = await conversationsService.getFeedback(
        req.user!.businessId!,
        routeParam(req.params.id)
      );
      res.json({ success: true, data: feedback });
    } catch (error) {
      next(error);
    }
  }
}

export const conversationsController = new ConversationsController();
