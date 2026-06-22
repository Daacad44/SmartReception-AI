import { Router } from 'express';
import { twoFactorController } from './two-factor.controller';
import { authenticate } from '../../core/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/status', (req, res, next) => twoFactorController.status(req, res, next));
router.post('/setup', (req, res, next) => twoFactorController.setup(req, res, next));
router.post('/confirm', (req, res, next) => twoFactorController.confirm(req, res, next));
router.post('/disable', (req, res, next) => twoFactorController.disable(req, res, next));

export default router;
