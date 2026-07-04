import { Router } from 'express';
import { auditController } from './audit.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { requireBusiness } from '../../core/middleware/authorize.middleware';

const router = Router();

router.use(authenticate, requireBusiness);

router.get('/logs', (req, res, next) => auditController.list(req, res, next));

export default router;
