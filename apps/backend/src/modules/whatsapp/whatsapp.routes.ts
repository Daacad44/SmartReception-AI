import { Router } from 'express';
import { whatsappController } from './whatsapp.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

// Legacy Meta webhook path (backward compatible)
router.get('/webhook', (req, res, next) => whatsappController.verify(req, res, next));
router.post('/webhook', (req, res, next) => whatsappController.webhook(req, res, next));

router.use(authenticate, requireBusiness);

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
router.post('/connect-env', authorize(PERMISSIONS['settings:write']), (req, res, next) =>
  whatsappController.connectFromEnv(req, res, next)
);
router.post('/test', authorize(PERMISSIONS['settings:write']), (req, res, next) =>
  whatsappController.testConnection(req, res, next)
);
router.delete('/accounts/:id', authorize(PERMISSIONS['settings:write']), (req, res, next) =>
  whatsappController.disconnectAccount(req, res, next)
);

export default router;
