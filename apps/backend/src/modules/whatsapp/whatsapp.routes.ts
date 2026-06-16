import { Router } from 'express';
import { whatsappController } from './whatsapp.controller';

const router = Router();

router.get('/webhook', (req, res, next) => whatsappController.verify(req, res, next));
router.post('/webhook', (req, res, next) => whatsappController.webhook(req, res, next));

export default router;
