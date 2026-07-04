import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { trainerAuthService } from './trainer-auth.service';
import { aiTrainingMgmtService } from '../ai-training-mgmt.service';
import { trainingJobService } from '../training-job.service';
import { sandboxService } from '../sandbox.service';
import { deploymentService } from '../deployment.service';
import { trainerService } from './trainer.service';
import { authenticateTrainer, requireTrainerBusiness, type TrainerRequest } from './trainer.middleware';

const router = Router();

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await trainerAuthService.login(req.body, req.ip, req.get('user-agent') ?? undefined);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.use(authenticateTrainer);

router.get('/me', async (req: TrainerRequest, res: Response, next: NextFunction) => {
  try {
    const trainer = await trainerService.getTrainer(req.trainer!.id);
    res.json({ success: true, data: trainer });
  } catch (error) {
    next(error);
  }
});

router.get('/businesses', async (req: TrainerRequest, res: Response, next: NextFunction) => {
  try {
    const businesses = await trainerService.listAssignedBusinesses(req.trainer!.id);
    res.json({ success: true, data: businesses });
  } catch (error) {
    next(error);
  }
});

router.get('/dashboard', requireTrainerBusiness, async (req: TrainerRequest, res: Response, next: NextFunction) => {
  try {
    const data = await aiTrainingMgmtService.getDashboard(req.trainer!.businessId!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/train', requireTrainerBusiness, async (req: TrainerRequest, res: Response, next: NextFunction) => {
  try {
    const result = await trainingJobService.createJob({
      businessId: req.trainer!.businessId!,
      type: req.body.type ?? 'FULL_TRAIN',
      trainerId: req.trainer!.id,
      trainingNotes: req.body.trainingNotes,
      documentIds: req.body.documentIds,
    });
    res.status(202).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/jobs', requireTrainerBusiness, async (req: TrainerRequest, res: Response, next: NextFunction) => {
  try {
    const jobs = await trainingJobService.listJobs(req.trainer!.businessId!);
    res.json({ success: true, data: jobs });
  } catch (error) {
    next(error);
  }
});

router.post('/sandbox/sessions', requireTrainerBusiness, async (req: TrainerRequest, res: Response, next: NextFunction) => {
  try {
    const session = await sandboxService.createSession(req.trainer!.businessId!, req.body.versionId, {
      trainerId: req.trainer!.id,
      label: req.body.label,
    });
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
});

router.post('/sandbox/sessions/:sessionId/messages', requireTrainerBusiness, async (req: TrainerRequest, res: Response, next: NextFunction) => {
  try {
    const message = await sandboxService.sendMessage(
      req.trainer!.businessId!,
      req.params.sessionId as string,
      req.body.content,
      { trainerId: req.trainer!.id }
    );
    res.json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
});

router.post('/deployments/request', requireTrainerBusiness, async (req: TrainerRequest, res: Response, next: NextFunction) => {
  try {
    const request = await deploymentService.requestDeployment(req.trainer!.businessId!, req.body.versionId, {
      businessId: req.trainer!.businessId!,
      trainerId: req.trainer!.id,
      deploymentSummary: req.body.deploymentSummary,
      sandboxTestSummary: req.body.sandboxTestSummary,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });
    res.status(201).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
});

export default router;
