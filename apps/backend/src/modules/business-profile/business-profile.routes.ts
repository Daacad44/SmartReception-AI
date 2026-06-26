import { Router } from 'express';
import multer from 'multer';
import { businessProfileController } from './business-profile.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

router.use(authenticate, requireBusiness);

router.get('/', authorize(PERMISSIONS['settings:read']), (req, res, next) =>
  businessProfileController.get(req, res, next)
);
router.patch('/', authorize(PERMISSIONS['settings:write']), (req, res, next) =>
  businessProfileController.update(req, res, next)
);
router.post(
  '/upload-pdf',
  authorize(PERMISSIONS['settings:write']),
  upload.single('file'),
  (req, res, next) => businessProfileController.uploadPdf(req, res, next)
);
router.post('/reprocess-pdf', authorize(PERMISSIONS['settings:write']), (req, res, next) =>
  businessProfileController.reprocessPdf(req, res, next)
);
router.delete('/pdf', authorize(PERMISSIONS['settings:write']), (req, res, next) =>
  businessProfileController.deletePdf(req, res, next)
);
router.delete('/', authorize(PERMISSIONS['settings:write']), (req, res, next) =>
  businessProfileController.clearProfile(req, res, next)
);

export default router;
