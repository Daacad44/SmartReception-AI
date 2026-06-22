import { Router } from 'express';
import { appointmentsController } from './appointments.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  appointmentsController.list(req, res, next)
);
router.get('/calendar', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  appointmentsController.calendar(req, res, next)
);
router.get('/availability', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  appointmentsController.availability(req, res, next)
);
router.post('/', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  appointmentsController.create(req, res, next)
);
router.get('/:id', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  appointmentsController.get(req, res, next)
);
router.post('/:id/actions', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  appointmentsController.performAction(req, res, next)
);
router.post('/:id/notes', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  appointmentsController.addNote(req, res, next)
);
router.patch('/:id', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  appointmentsController.update(req, res, next)
);
router.delete('/:id', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  appointmentsController.delete(req, res, next)
);

export default router;
