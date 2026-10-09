import { Router, type NextFunction, type Request, type Response } from 'express';
import { PERMISSIONS } from '@smartreception/shared';
import { authorize } from '../../core/middleware/authorize.middleware';
import { systemUpdatesService } from './system-updates.service';

const router = Router();
router.get('/', authorize(PERMISSIONS['settings:read']), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await systemUpdatesService.getStatus(req.user!.businessId!) }); } catch (error) { next(error); }
});
router.post('/apply', authorize(PERMISSIONS['settings:write']), async (req: Request, res: Response, next: NextFunction) => {
  try { res.json({ success: true, data: await systemUpdatesService.applyAll(req.user!.businessId!, req.user!.userId) }); } catch (error) { next(error); }
});
export default router;
