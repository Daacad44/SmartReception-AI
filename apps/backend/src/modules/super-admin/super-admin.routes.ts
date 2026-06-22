import { Router } from 'express';
import { superAdminController } from './super-admin.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { requireSuperAdmin } from '../../core/middleware/super-admin.middleware';

const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get('/stats', (req, res, next) => superAdminController.stats(req, res, next));
router.get('/businesses', (req, res, next) => superAdminController.businesses(req, res, next));
router.get('/users', (req, res, next) => superAdminController.users(req, res, next));
router.patch('/businesses/:id', (req, res, next) => superAdminController.toggleBusiness(req, res, next));

export default router;
