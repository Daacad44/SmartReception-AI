import { Router } from 'express';
import multer from 'multer';
import { knowledgeController } from './knowledge.controller';
import { authenticate } from '../../core/middleware/auth.middleware';
import { authorize, requireBusiness } from '../../core/middleware/authorize.middleware';
import { PERMISSIONS } from '@smartreception/shared';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authenticate, requireBusiness);

router.get('/bases', authorize(PERMISSIONS['knowledge:read']), (req, res, next) =>
  knowledgeController.listBases(req, res, next)
);
router.get('/bases/:id', authorize(PERMISSIONS['knowledge:read']), (req, res, next) =>
  knowledgeController.getBase(req, res, next)
);
router.post(
  '/documents/upload',
  authorize(PERMISSIONS['knowledge:write']),
  upload.single('file'),
  (req, res, next) => knowledgeController.uploadDocument(req, res, next)
);
router.post('/documents/:id/process', authorize(PERMISSIONS['knowledge:write']), (req, res, next) =>
  knowledgeController.processDocument(req, res, next)
);
router.get('/documents/:id/status', authorize(PERMISSIONS['knowledge:read']), (req, res, next) =>
  knowledgeController.getDocumentStatus(req, res, next)
);
router.get('/faqs', authorize(PERMISSIONS['knowledge:read']), (req, res, next) =>
  knowledgeController.listFaqs(req, res, next)
);
router.post('/faqs', authorize(PERMISSIONS['knowledge:write']), (req, res, next) =>
  knowledgeController.createFaq(req, res, next)
);
router.patch('/faqs/:id', authorize(PERMISSIONS['knowledge:write']), (req, res, next) =>
  knowledgeController.updateFaq(req, res, next)
);
router.delete('/faqs/:id', authorize(PERMISSIONS['knowledge:write']), (req, res, next) =>
  knowledgeController.deleteFaq(req, res, next)
);
router.get('/search', authorize(PERMISSIONS['knowledge:read']), (req, res, next) =>
  knowledgeController.search(req, res, next)
);
router.delete('/clear', authorize(PERMISSIONS['knowledge:write']), (req, res, next) =>
  knowledgeController.clearKnowledgeBase(req, res, next)
);
router.delete('/documents/:id', authorize(PERMISSIONS['knowledge:write']), (req, res, next) =>
  knowledgeController.deleteDocument(req, res, next)
);

export default router;
