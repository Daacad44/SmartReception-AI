import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { AiTrainingJobType, AiTrainingOperation } from '@prisma/client';
import { authenticate } from '../../core/middleware/auth.middleware';
import { requireSuperAdmin } from '../../core/middleware/super-admin.middleware';
import { trainingCenterService } from './training-center.service';
import { trainingVerificationService } from './training-verification.service';
import { trainingSessionLogService } from './training-session-log.service';
import { versionService } from './version.service';
import { prisma } from '../../infrastructure/database/prisma';

const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await trainingCenterService.getPlatformOverview();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/businesses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const search = req.query.search as string | undefined;
    const data = await trainingCenterService.listBusinessCards(page, limit, search);
    res.json({ success: true, data: data.data, meta: data.meta });
  } catch (error) {
    next(error);
  }
});

router.get('/businesses/:businessId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await trainingCenterService.getBusinessDetail(String(req.params.businessId));
    if (!data) {
      res.status(404).json({ success: false, error: 'Business not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.query.businessId as string | undefined;
    const limit = Number(req.query.limit) || 50;
    const offset = Number(req.query.offset) || 0;
    const data = await trainingSessionLogService.listSessions({ businessId, limit, offset });
    res.json({ success: true, data: data.data, meta: data.meta });
  } catch (error) {
    next(error);
  }
});

router.get('/sessions/:sessionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await trainingSessionLogService.getSession(String(req.params.sessionId));
    if (!data) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get('/businesses/:businessId/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versions = await versionService.listVersions(String(req.params.businessId));
    res.json({ success: true, data: versions });
  } catch (error) {
    next(error);
  }
});

router.get('/businesses/:businessId/versions/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versionAId = String(req.query.versionAId ?? '');
    const versionBId = String(req.query.versionBId ?? '');
    const data = await versionService.compareVersions(
      String(req.params.businessId),
      versionAId,
      versionBId
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/verify/request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const data = await trainingVerificationService.requestVerification({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      operation: req.body.operation as AiTrainingOperation,
      businessIds: req.body.businessIds ?? [],
      jobType: req.body.jobType as AiTrainingJobType | undefined,
      payload: req.body.payload,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/verify/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await trainingVerificationService.verifyAndExecute(
      String(req.body.requestId),
      String(req.body.code ?? ''),
      req.user!.userId
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/verify/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await trainingVerificationService.cancelVerification(
      String(req.body.requestId),
      req.user!.userId
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/preview/:businessId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trainingEngineService } = await import('./training-engine.service');
    const data = await trainingEngineService.executeVerifiedOperation({
      operation: 'PREVIEW',
      businessIds: [String(req.params.businessId)],
      payload: {},
      userId: req.user!.userId,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
