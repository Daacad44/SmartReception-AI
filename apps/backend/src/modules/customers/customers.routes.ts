import { Router } from 'express';
import { customersController } from './customers.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/', authorize(PERMISSIONS['customers:read']), (req, res, next) =>
  customersController.list(req, res, next)
);
router.post('/', authorize(PERMISSIONS['customers:write']), (req, res, next) =>
  customersController.create(req, res, next)
);

router.get('/tags', authorize(PERMISSIONS['customers:read']), (req, res, next) =>
  customersController.listTags(req, res, next)
);
router.post('/tags', authorize(PERMISSIONS['customers:write']), (req, res, next) =>
  customersController.createTag(req, res, next)
);
router.delete('/tags/:tagId', authorize(PERMISSIONS['customers:write']), (req, res, next) =>
  customersController.deleteTag(req, res, next)
);

router.get('/:id', authorize(PERMISSIONS['customers:read']), (req, res, next) =>
  customersController.get(req, res, next)
);
router.patch('/:id', authorize(PERMISSIONS['customers:write']), (req, res, next) =>
  customersController.update(req, res, next)
);
router.delete('/:id', authorize(PERMISSIONS['customers:write']), (req, res, next) =>
  customersController.delete(req, res, next)
);
router.put('/:id/tags', authorize(PERMISSIONS['customers:write']), (req, res, next) =>
  customersController.assignTags(req, res, next)
);
router.get('/:id/notes', authorize(PERMISSIONS['customers:read']), (req, res, next) =>
  customersController.getNotes(req, res, next)
);
router.post('/:id/notes', authorize(PERMISSIONS['customers:write']), (req, res, next) =>
  customersController.addNote(req, res, next)
);
router.get('/:id/timeline', authorize(PERMISSIONS['customers:read']), (req, res, next) =>
  customersController.getTimeline(req, res, next)
);
router.get('/:id/insights', authorize(PERMISSIONS['customers:read']), (req, res, next) =>
  customersController.getInsights(req, res, next)
);
router.get('/:id/profile', authorize(PERMISSIONS['customers:read']), (req, res, next) =>
  customersController.getProfile(req, res, next)
);

export default router;
