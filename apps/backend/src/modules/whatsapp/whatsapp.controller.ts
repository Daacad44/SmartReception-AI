import { Request, Response, NextFunction } from 'express';
import { whatsappModuleService } from './whatsapp.service';
import { logger } from '../../core/logger';
import { connectWhatsAppSchema } from '@smartreception/shared';
import { routeParam } from '../../core/utils';
import { config } from '../../config';

export class WhatsAppController {
  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const mode = req.query['hub.mode'] as string;
      const token = req.query['hub.verify_token'] as string;
      const challenge = req.query['hub.challenge'] as string;

      console.log('Mode:', mode);
      console.log('Token:', token);
      console.log('Challenge:', challenge);
      console.log('Expected:', process.env.WHATSAPP_VERIFY_TOKEN ?? config.whatsapp.verifyToken);

      logger.info('WhatsApp webhook verification attempt', {
        mode,
        tokenReceived: Boolean(token),
        challengeReceived: Boolean(challenge),
        path: req.path,
        host: req.get('host'),
      });

      const result = whatsappModuleService.verifyWebhook(mode, token, challenge);
      if (result) {
        console.log('[WhatsApp Webhook] Verification succeeded');
        await whatsappModuleService.recordWebhookVerificationSuccess();
        res.status(200).type('text/plain').send(result);
        return;
      }

      console.log('[WhatsApp Webhook] Verification failed — token mismatch or invalid mode');
      logger.warn('WhatsApp webhook verification failed', {
        mode,
        tokenMatch: (token ?? '').trim() === config.whatsapp.verifyToken,
        expectedLength: config.whatsapp.verifyToken.length,
        receivedLength: (token ?? '').trim().length,
      });
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
        logger.warn('WhatsApp webhook rejected: invalid signature');
        res.status(403).json({ success: false, error: 'Invalid webhook signature' });
        return;
      }

      res.status(200).send('EVENT_RECEIVED');

      whatsappModuleService.recordWebhookReceived(req.body).catch((error) => {
        logger.error('WhatsApp webhook receipt recording error:', error);
      });

      whatsappModuleService.processWebhook(req.body).catch((error) => {
        logger.error('WhatsApp webhook processing error:', error);
      });
    } catch (error) {
      next(error);
    }
  }

  async getWebhookStatus(req: Request, res: Response) {
    res.json({
      success: true,
      data: {
        webhookUrl: config.whatsapp.webhookUrl,
        verifyTokenConfigured: Boolean(config.whatsapp.verifyToken),
        verifyTokenLength: config.whatsapp.verifyToken.length,
        verifyTokenMatchesDefault:
          config.whatsapp.verifyToken === 'smartreception-verify',
        host: req.get('host'),
      },
    });
  }

  async listAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const accounts = await whatsappModuleService.listAccounts(req.user!.businessId!);
      res.json({ success: true, data: accounts });
    } catch (error) {
      next(error);
    }
  }

  async getWebhookHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const health = await whatsappModuleService.getWebhookHealth(req.user!.businessId!);
      res.json({ success: true, data: health });
    } catch (error) {
      next(error);
    }
  }

  async getHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const health = await whatsappModuleService.getHealth(req.user!.businessId!);
      res.json({ success: true, data: health });
    } catch (error) {
      next(error);
    }
  }

  async getConnectionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = await whatsappModuleService.getConnectionStatus(req.user!.businessId!);
      res.json({ success: true, data: status });
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
          legacyWebhookUrl: whatsappModuleService.getLegacyWebhookUrl(),
          verifyToken: config.whatsapp.verifyToken,
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

  async connectFromEnv(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await whatsappModuleService.connectFromEnv(req.user!.businessId!);
      res.status(201).json({ success: true, data: account });
    } catch (error) {
      next(error);
    }
  }

  async testConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const accountId = req.body?.accountId as string | undefined;
      const result = await whatsappModuleService.testConnection(req.user!.businessId!, accountId);
      res.json({ success: true, data: result });
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
