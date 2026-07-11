import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../core/middleware/auth.middleware';
import { requireSuperAdmin } from '../../core/middleware/super-admin.middleware';
import { trainerService } from './trainer/trainer.service';
import { deploymentService } from './deployment.service';
import { parseDeviceLabel } from './audit.service';

const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get('/trainers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const trainers = await trainerService.listTrainers();
    res.json({ success: true, data: trainers });
  } catch (error) {
    next(error);
  }
});

router.post('/trainers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trainer = await trainerService.createTrainer(req.body);
    res.status(201).json({ success: true, data: trainer });
  } catch (error) {
    next(error);
  }
});

router.get('/trainers/:trainerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trainer = await trainerService.getTrainer(String(req.params.trainerId));
    res.json({ success: true, data: trainer });
  } catch (error) {
    next(error);
  }
});

router.patch('/trainers/:trainerId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const trainer = await trainerService.updateTrainer(String(req.params.trainerId), req.body);
    res.json({ success: true, data: trainer });
  } catch (error) {
    next(error);
  }
});

router.get('/deployments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const requests = await deploymentService.listRequests(undefined, status);
    res.json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
});

router.get('/deployments/:requestId/readiness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const request = await deploymentService.getRequest(String(req.params.requestId));
    const readiness = await deploymentService.evaluateDeploymentReadiness(
      request.businessId,
      request.versionId
    );
    res.json({ success: true, data: readiness });
  } catch (error) {
    next(error);
  }
});

router.post('/deployments/:requestId/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deploymentService.approve(
      String(req.params.requestId),
      req.user!.userId,
      {
        businessId: '',
        userId: req.user!.userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
        deviceLabel: parseDeviceLabel(req.get('user-agent') ?? undefined),
      },
      { override: req.body?.override === true }
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/deployments/:requestId/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deploymentService.reject(
      String(req.params.requestId),
      req.user!.userId,
      req.body.reason ?? 'Rejected by Super Admin',
      {
        businessId: '',
        userId: req.user!.userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      }
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/deployments/:requestId/request-changes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deploymentService.requestChanges(
      String(req.params.requestId),
      req.user!.userId,
      req.body.notes ?? ''
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/deployments/:requestId/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deploymentService.publishToProduction(String(req.params.requestId), req.user!.userId, {
      businessId: '',
      userId: req.user!.userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
      deviceLabel: parseDeviceLabel(req.get('user-agent') ?? undefined),
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
