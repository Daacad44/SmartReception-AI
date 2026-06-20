import { Router } from 'express';
import { whatsappController } from './whatsapp.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.get('/webhook', (req, res, next) => whatsappController.verify(req, res, next));
router.post('/webhook', (req, res, next) => whatsappController.webhook(req, res, next));

router.use(authenticate, requireBusiness);

router.get('/accounts', authorize(PERMISSIONS['settings:read']), (req, res, next) =>
  whatsappController.listAccounts(req, res, next)
);
router.get('/webhook-info', authorize(PERMISSIONS['settings:read']), (req, res, next) =>
  whatsappController.getWebhookInfo(req, res, next)
);
router.post('/accounts', authorize(PERMISSIONS['settings:write']), (req, res, next) =>
  whatsappController.connectAccount(req, res, next)
);
router.delete('/accounts/:id', authorize(PERMISSIONS['settings:write']), (req, res, next) =>
  whatsappController.disconnectAccount(req, res, next)
);

export default router;
