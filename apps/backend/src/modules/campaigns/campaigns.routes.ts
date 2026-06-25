import { Router } from 'express';
import { campaignsController } from './campaigns.controller';
import { campaignJourneyController } from './campaign-journey.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/', authorize(PERMISSIONS['campaigns:read']), (req, res, next) =>
  campaignsController.list(req, res, next)
);
router.get('/calendar', authorize(PERMISSIONS['campaigns:read']), (req, res, next) =>
  campaignsController.calendar(req, res, next)
);
router.get('/analytics', authorize(PERMISSIONS['campaigns:read']), (req, res, next) =>
  campaignsController.analytics(req, res, next)
);
router.get('/deliveries', authorize(PERMISSIONS['campaigns:read']), (req, res, next) =>
  campaignsController.deliveries(req, res, next)
);
router.post('/generate-ai', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignsController.generateAi(req, res, next)
);

router.get('/journeys/list', authorize(PERMISSIONS['campaigns:read']), (req, res, next) =>
  campaignJourneyController.list(req, res, next)
);
router.post('/journeys', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignJourneyController.create(req, res, next)
);
router.get('/journeys/:id', authorize(PERMISSIONS['campaigns:read']), (req, res, next) =>
  campaignJourneyController.get(req, res, next)
);
router.post('/journeys/:id/activate', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignJourneyController.activate(req, res, next)
);
router.post('/journeys/:id/pause', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignJourneyController.pause(req, res, next)
);
router.post('/journeys/:id/enroll', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignJourneyController.enroll(req, res, next)
);

router.post('/', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignsController.create(req, res, next)
);
router.get('/:id', authorize(PERMISSIONS['campaigns:read']), (req, res, next) =>
  campaignsController.get(req, res, next)
);
router.patch('/:id', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignsController.update(req, res, next)
);
router.post('/:id/cancel', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignsController.cancel(req, res, next)
);
router.post('/:id/send', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignsController.sendNow(req, res, next)
);
router.post('/:id/pause', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignsController.pause(req, res, next)
);
router.post('/:id/resume', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignsController.resume(req, res, next)
);
router.post('/:id/duplicate', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignsController.duplicate(req, res, next)
);
router.post('/:id/archive', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignsController.archive(req, res, next)
);
router.post('/:id/test-send', authorize(PERMISSIONS['campaigns:write']), (req, res, next) =>
  campaignsController.testSend(req, res, next)
);

export default router;
