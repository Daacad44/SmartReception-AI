import { Router } from 'express';
import { whatsappController } from './whatsapp.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';
import { logger } from '../../core/logger';

const router = Router();

// Legacy Meta webhook path — kept for tenants whose Meta App is still
// configured against it. New connections (see /oauth/exchange below) are
// pointed at the canonical /api/v1/webhooks/whatsapp path instead. This
// route can be retired once traffic here drops to zero (tracked via the
// warning below) — do not remove without confirming there's no live usage.
function logLegacyWebhookHit(req: import('express').Request) {
  logger.warn('Deprecated WhatsApp webhook path hit — migrate this WABA to /api/v1/webhooks/whatsapp', {
    path: req.originalUrl,
    method: req.method,
  });
}
router.get('/webhook', (req, res, next) => {
  logLegacyWebhookHit(req);
  return whatsappController.verify(req, res, next);
});
router.post('/webhook', (req, res, next) => {
  logLegacyWebhookHit(req);
  return whatsappController.webhook(req, res, next);
});

router.use(authenticate, requireBusiness);

router.get('/debug/send-status', authorize(PERMISSIONS['settings:read']), (req, res, next) =>
  whatsappController.getSendStatus(req, res, next)
);
router.get('/debug', authorize(PERMISSIONS['settings:read']), (req, res, next) =>
  whatsappController.getDebug(req, res, next)
);
router.get('/webhook-health', authorize(PERMISSIONS['settings:read']), (req, res, next) =>
  whatsappController.getWebhookHealth(req, res, next)
);
router.get('/health', authorize(PERMISSIONS['settings:read']), (req, res, next) =>
  whatsappController.getHealth(req, res, next)
);
router.get('/accounts', authorize(PERMISSIONS['settings:read']), (req, res, next) =>
  whatsappController.listAccounts(req, res, next)
);
router.get('/status', authorize(PERMISSIONS['settings:read']), (req, res, next) =>
  whatsappController.getConnectionStatus(req, res, next)
);
router.get('/webhook-info', authorize(PERMISSIONS['settings:read']), (req, res, next) =>
  whatsappController.getWebhookInfo(req, res, next)
);
router.post('/accounts', authorize(PERMISSIONS['settings:write']), (req, res, next) =>
  whatsappController.connectAccount(req, res, next)
);
router.get('/oauth/config', authorize(PERMISSIONS['settings:read']), (req, res, next) =>
  whatsappController.getOAuthConfig(req, res, next)
);
router.post('/oauth/exchange', authorize(PERMISSIONS['settings:write']), (req, res, next) =>
  whatsappController.exchangeOAuthCode(req, res, next)
);
router.post('/connect-env', authorize(PERMISSIONS['settings:write']), (req, res, next) =>
  whatsappController.connectFromEnv(req, res, next)
);
router.post('/test', authorize(PERMISSIONS['settings:write']), (req, res, next) =>
  whatsappController.testConnection(req, res, next)
);
router.patch('/accounts/:id', authorize(PERMISSIONS['settings:write']), (req, res, next) =>
  whatsappController.updateAccount(req, res, next)
);
router.delete('/accounts/:id', authorize(PERMISSIONS['settings:write']), (req, res, next) =>
  whatsappController.disconnectAccount(req, res, next)
);

export default router;
