import { Request, Response, NextFunction } from 'express';
import { whatsappModuleService } from './whatsapp.service';
import { logger } from '../../core/logger';

export class WhatsAppController {
  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const mode = req.query['hub.mode'] as string;
      const token = req.query['hub.verify_token'] as string;
      const challenge = req.query['hub.challenge'] as string;

      const result = whatsappModuleService.verifyWebhook(mode, token, challenge);
      if (result) {
        res.status(200).send(result);
        return;
      }

      res.status(403).json({ success: false, error: 'Verification failed' });
    } catch (error) {
      next(error);
    }
  }

  async webhook(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).send('EVENT_RECEIVED');

      whatsappModuleService.processWebhook(req.body).catch((error) => {
        logger.error('WhatsApp webhook processing error:', error);
      });
    } catch (error) {
      next(error);
    }
  }
}

export const whatsappController = new WhatsAppController();
