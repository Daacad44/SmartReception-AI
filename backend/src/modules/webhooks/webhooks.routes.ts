import { Router } from 'express';
import { whatsappController } from '../../modules/whatsapp/whatsapp.controller';

const router = Router();

router.get('/whatsapp', (req, res, next) => whatsappController.verify(req, res, next));
router.post('/whatsapp', (req, res, next) => whatsappController.webhook(req, res, next));

export default router;
