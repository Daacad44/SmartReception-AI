import { Request, Response, NextFunction } from 'express';
import { whatsappModuleService } from './whatsapp.service';
import { logger } from '../../core/logger';
import { connectWhatsAppSchema } from '@smartreception/shared';
import { routeParam } from '../../core/utils';

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
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      const signature = req.headers['x-hub-signature-256'] as string | undefined;

      if (rawBody && !whatsappModuleService.verifyWebhookSignature(rawBody, signature)) {
        res.status(403).json({ success: false, error: 'Invalid webhook signature' });
        return;
      }

      res.status(200).send('EVENT_RECEIVED');

      whatsappModuleService.processWebhook(req.body).catch((error) => {
        logger.error('WhatsApp webhook processing error:', error);
      });
    } catch (error) {
      next(error);
    }
  }

  async listAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const accounts = await whatsappModuleService.listAccounts(req.user!.businessId!);
      res.json({ success: true, data: accounts });
    } catch (error) {
      next(error);
    }
  }

  async getWebhookInfo(req: Request, res: Response, next: NextFunction) {
    try {
      res.json({
        success: true,
        data: {
          webhookUrl: whatsappModuleService.getWebhookUrl(),
          verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'smartreception-verify',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async connectAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const input = connectWhatsAppSchema.parse(req.body);
      const account = await whatsappModuleService.connectAccount(req.user!.businessId!, input);
      res.status(201).json({ success: true, data: account });
    } catch (error) {
      next(error);
    }
  }

  async disconnectAccount(req: Request, res: Response, next: NextFunction) {
    try {
      await whatsappModuleService.disconnectAccount(
        req.user!.businessId!,
        routeParam(req.params.id)
      );
      res.json({ success: true, message: 'WhatsApp account disconnected' });
    } catch (error) {
      next(error);
    }
  }
}

export const whatsappController = new WhatsAppController();
