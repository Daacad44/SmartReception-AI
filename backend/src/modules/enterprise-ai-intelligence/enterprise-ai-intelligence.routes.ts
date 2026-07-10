import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../core/middleware/auth.middleware';
import { requireBusiness } from '../../core/middleware/authorize.middleware';
import { requireSuperAdmin } from '../../core/middleware/super-admin.middleware';
import { enterpriseAiIntelligenceService } from './enterprise-ai-intelligence.service';
import { trainingVerificationService } from '../ai-training-mgmt/training-verification.service';
import { trainingEngineService } from '../ai-training-mgmt/training-engine.service';
import { aiTrainingAnalyticsService } from '../ai-training-mgmt/analytics.service';
import { aiTrainingMgmtService } from '../ai-training-mgmt/ai-training-mgmt.service';
import { prisma } from '../../infrastructure/database/prisma';
import type { AiTrainingJobType, AiTrainingOperation } from '@prisma/client';

const tenantRouter = Router();
const adminRouter = Router();

tenantRouter.use(authenticate, requireBusiness);

tenantRouter.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await enterpriseAiIntelligenceService.getTenantDashboard(req.user!.businessId!);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

tenantRouter.get('/monitoring', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await enterpriseAiIntelligenceService.getMonitoring({
      businessId: req.user!.businessId!,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

tenantRouter.get('/validation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await enterpriseAiIntelligenceService.getValidationReport(
      req.user!.businessId!,
      req.query.sessionId as string | undefined
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.use(authenticate, requireSuperAdmin);

adminRouter.get('/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await enterpriseAiIntelligenceService.getPlatformOverview();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/businesses', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const search = req.query.search as string | undefined;
    const data = await enterpriseAiIntelligenceService.listBusinesses(page, limit, search);
    res.json({ success: true, data: data.data, meta: data.meta });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/businesses/:businessId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await enterpriseAiIntelligenceService.getBusinessDetail(
      String(req.params.businessId)
    );
    if (!data) {
      res.status(404).json({ success: false, error: 'Business not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.get(
  '/businesses/:businessId/analytics',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Scoped to a single business — the analytics service filters every query
      // by businessId, keeping each tenant's AI workspace fully isolated.
      const data = await aiTrainingAnalyticsService.getAnalytics(String(req.params.businessId));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

adminRouter.get(
  '/businesses/:businessId/audit-logs',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Number(req.query.limit) || 100;
      const data = await aiTrainingMgmtService.getAuditLogs(
        String(req.params.businessId),
        limit
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

adminRouter.get('/monitoring', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await enterpriseAiIntelligenceService.getMonitoring({
      businessId: req.query.businessId as string | undefined,
      limit: Number(req.query.limit) || 50,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.get(
  '/businesses/:businessId/validation',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await enterpriseAiIntelligenceService.getValidationReport(
        String(req.params.businessId),
        req.query.sessionId as string | undefined
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

adminRouter.post(
  '/businesses/:businessId/playground/sessions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await enterpriseAiIntelligenceService.createPlaygroundSession(
        String(req.params.businessId),
        String(req.body.versionId),
        { userId: req.user!.userId, label: req.body.label }
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

adminRouter.post(
  '/businesses/:businessId/playground/sessions/:sessionId/messages',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await enterpriseAiIntelligenceService.sendPlaygroundMessage(
        String(req.params.businessId),
        String(req.params.sessionId),
        String(req.body.content ?? ''),
        req.user!.userId
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

adminRouter.post('/verify/request', async (req: Request, res: Response, next: NextFunction) => {
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

adminRouter.post('/verify/confirm', async (req: Request, res: Response, next: NextFunction) => {
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

adminRouter.post('/verify/cancel', async (req: Request, res: Response, next: NextFunction) => {
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

adminRouter.post('/preview/:businessId', async (req: Request, res: Response, next: NextFunction) => {
  try {
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

export { tenantRouter as enterpriseAiIntelligenceRoutes, adminRouter as enterpriseAiIntelligenceAdminRoutes };
