import { Router } from 'express';
import multer from 'multer';
import { customerImportController } from './customer-import.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authenticate, requireBusiness);

router.get('/jobs', authorize(PERMISSIONS['customers:read']), (req, res, next) =>
  customerImportController.listJobs(req, res, next)
);
router.get('/jobs/:id', authorize(PERMISSIONS['customers:read']), (req, res, next) =>
  customerImportController.getJob(req, res, next)
);
router.post(
  '/upload',
  authorize(PERMISSIONS['customers:write']),
  upload.single('file'),
  (req, res, next) => customerImportController.upload(req, res, next)
);

export default router;
