import { Router } from 'express';
import { conversationsController } from './conversations.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/', authorize(PERMISSIONS['conversations:read']), (req, res, next) =>
  conversationsController.list(req, res, next)
);
router.get('/summary', authorize(PERMISSIONS['conversations:read']), (req, res, next) =>
  conversationsController.summary(req, res, next)
);
router.get('/:id/messages', authorize(PERMISSIONS['conversations:read']), (req, res, next) =>
  conversationsController.getMessages(req, res, next)
);
router.get('/:id', authorize(PERMISSIONS['conversations:read']), (req, res, next) =>
  conversationsController.get(req, res, next)
);
router.post('/:id/messages', authorize(PERMISSIONS['conversations:write']), (req, res, next) =>
  conversationsController.sendMessage(req, res, next)
);
router.post('/:id/takeover', authorize(PERMISSIONS['conversations:write']), (req, res, next) =>
  conversationsController.takeover(req, res, next)
);
router.post('/:id/transfer-ai', authorize(PERMISSIONS['conversations:write']), (req, res, next) =>
  conversationsController.transferToAi(req, res, next)
);
router.post('/:id/handoff', authorize(PERMISSIONS['conversations:write']), (req, res, next) =>
  conversationsController.handoffToHuman(req, res, next)
);
router.post('/:id/typing', authorize(PERMISSIONS['conversations:write']), (req, res, next) =>
  conversationsController.sendTyping(req, res, next)
);
router.patch('/:id/read', authorize(PERMISSIONS['conversations:write']), (req, res, next) =>
  conversationsController.markAsRead(req, res, next)
);

export default router;
