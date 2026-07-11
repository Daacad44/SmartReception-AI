import { Router } from 'express';
import { appointmentSchedulingController } from './appointment-scheduling.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();
const ctrl = appointmentSchedulingController;

router.use(authenticate, requireBusiness);

// Appointment settings (weekly hours, slot config, buffers)
router.get('/settings', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  ctrl.getSettings(req, res, next)
);
router.put('/settings', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  ctrl.updateSettings(req, res, next)
);

// Business exceptions (holidays / closures / special hours)
router.get('/exceptions', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  ctrl.listExceptions(req, res, next)
);
router.post('/exceptions', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  ctrl.createException(req, res, next)
);
router.patch('/exceptions/:id', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  ctrl.updateException(req, res, next)
);
router.delete('/exceptions/:id', authorize(PERMISSIONS['appointments:write']), (req, res, next) =>
  ctrl.deleteException(req, res, next)
);

// Availability (real slots from the engine)
router.get('/availability/day', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  ctrl.day(req, res, next)
);
router.get('/availability/upcoming', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  ctrl.upcoming(req, res, next)
);
router.get('/working-hours', authorize(PERMISSIONS['appointments:read']), (req, res, next) =>
  ctrl.workingHours(req, res, next)
);

export default router;
