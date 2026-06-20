import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { config, logWhatsAppConfig } from './config';
import { errorHandler, notFoundHandler } from './core/error-handler';
import routes from './routes';
import { logger } from './core/logger';
import { prisma } from './infrastructure/database/prisma';
import { isSupabaseStorageConfigured } from './infrastructure/storage';
import { createRateLimiter } from './core/rate-limit-store';
import { whatsappController } from './modules/whatsapp/whatsapp.controller';

const WEBHOOK_RAW_PATHS = [
  '/webhook',
  '/api/webhook',
  '/api/v1/whatsapp/webhook',
  '/api/v1/webhooks/whatsapp',
  '/api/v1/billing/webhook',
];

export function createApp(): express.Application {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy:
        config.env === 'production'
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
                fontSrc: ["'self'", 'data:'],
                frameSrc: ["'none'"],
                objectSrc: ["'none'"],
              },
            }
          : false,
      hsts: config.env === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
    })
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        const allowed = [
          config.frontendUrl,
          'https://somreception.botandev.com',
          'https://api.somreception.botandev.com',
        ];
        if (process.env.VERCEL_URL) {
          allowed.push(`https://${process.env.VERCEL_URL}`);
        }
        if (
          !origin ||
          allowed.includes(origin) ||
          origin.endsWith('.vercel.app')
        ) {
          callback(null, true);
        } else {
          callback(null, config.env !== 'production');
        }
      },
      credentials: true,
    })
  );
  app.use(compression());
  app.use(cookieParser());

  const rawJson = express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  });

  const verifyHandler = (req: express.Request, res: express.Response, next: express.NextFunction) =>
    whatsappController.verify(req, res, next);
  const webhookHandler = (req: express.Request, res: express.Response, next: express.NextFunction) =>
    whatsappController.webhook(req, res, next);

  // Meta WhatsApp webhook — mounted BEFORE rate limiter so verification always succeeds
  app.get('/webhook/status', (req, res) => whatsappController.getWebhookStatus(req, res));
  app.get('/webhook', verifyHandler);
  app.get('/api/webhook', verifyHandler);
  app.post('/webhook', rawJson, webhookHandler);
  app.post('/api/webhook', rawJson, webhookHandler);

  app.use(
    createRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: config.env === 'production' ? 200 : 1000,
      skip: (req) => WEBHOOK_RAW_PATHS.some((path) => req.path === path || req.path.endsWith('/webhook')),
    })
  );

  for (const path of WEBHOOK_RAW_PATHS) {
    app.use(path, rawJson);
  }

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/health', async (_req, res) => {
    const timestamp = new Date().toISOString();
    const jwtConfigured =
      Boolean(process.env.JWT_SECRET) &&
      process.env.JWT_SECRET !== 'dev-secret-change-me';
    const storageConfigured = isSupabaseStorageConfigured() || Boolean(process.env.R2_ACCESS_KEY_ID);

    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: 'ok',
        database: 'connected',
        auth: jwtConfigured ? 'configured' : 'missing_jwt_secret',
        storage: storageConfigured ? 'configured' : 'missing_supabase_service_role_key',
        webhookUrl: config.whatsapp.webhookUrl,
        verifyTokenConfigured: Boolean(config.whatsapp.verifyToken),
        timestamp,
      });
    } catch {
      res.status(503).json({
        status: 'degraded',
        database: 'disconnected',
        auth: jwtConfigured ? 'configured' : 'missing_jwt_secret',
        storage: storageConfigured ? 'configured' : 'missing_supabase_service_role_key',
        webhookUrl: config.whatsapp.webhookUrl,
        verifyTokenConfigured: Boolean(config.whatsapp.verifyToken),
        timestamp,
      });
    }
  });

  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  logWhatsAppConfig();
  logger.info('Express app configured', { webhookUrl: config.whatsapp.webhookUrl });

  return app;
}
