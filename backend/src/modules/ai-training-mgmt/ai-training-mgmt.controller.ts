import type { Request, Response, NextFunction } from 'express';
import { aiTrainingMgmtService } from './ai-training-mgmt.service';
import { trainingJobService } from './training-job.service';
import { versionService } from './version.service';
import { sandboxService } from './sandbox.service';
import { deploymentService } from './deployment.service';
import { insightsService } from './insights.service';
import { aiTrainingAnalyticsService } from './analytics.service';
import { parseDeviceLabel } from './audit.service';

function auditFromReq(req: Request) {
  return {
    businessId: req.user!.businessId!,
    userId: req.user!.userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
    deviceLabel: parseDeviceLabel(req.get('user-agent') ?? undefined),
  };
}

export class AiTrainingMgmtController {
  getDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await aiTrainingMgmtService.getDashboard(req.user!.businessId!);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  startTraining = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type = 'FULL_TRAIN', trainingNotes, documentIds } = req.body;
      const result = await trainingJobService.createJob({
        businessId: req.user!.businessId!,
        type,
        userId: req.user!.userId,
        trainingNotes,
        documentIds,
      });
      res.status(result.existing ? 200 : 202).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  listJobs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobs = await trainingJobService.listJobs(req.user!.businessId!);
      res.json({ success: true, data: jobs });
    } catch (error) {
      next(error);
    }
  };

  getJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await trainingJobService.getJob(req.user!.businessId!, String(req.params.jobId));
      res.json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  };

  cancelJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await trainingJobService.cancelJob(req.user!.businessId!, String(req.params.jobId));
      res.json({ success: true, data: job });
    } catch (error) {
      next(error);
    }
  };

  listVersions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const versions = await versionService.listVersions(req.user!.businessId!);
      res.json({ success: true, data: versions });
    } catch (error) {
      next(error);
    }
  };

  getVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const version = await versionService.getVersion(req.user!.businessId!, String(req.params.versionId));
      res.json({ success: true, data: version });
    } catch (error) {
      next(error);
    }
  };

  compareVersions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { versionAId, versionBId } = req.query;
      const comparison = await versionService.compareVersions(
        req.user!.businessId!,
        String(versionAId),
        String(versionBId)
      );
      res.json({ success: true, data: comparison });
    } catch (error) {
      next(error);
    }
  };

  rollbackVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const version = await versionService.rollback(
        req.user!.businessId!,
        String(req.params.versionId),
        auditFromReq(req)
      );
      res.json({ success: true, data: version });
    } catch (error) {
      next(error);
    }
  };

  createSandboxSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await sandboxService.createSession(
        req.user!.businessId!,
        req.body.versionId,
        { userId: req.user!.userId, label: req.body.label }
      );
      res.status(201).json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  };

  listSandboxSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessions = await sandboxService.listSessions(
        req.user!.businessId!,
        req.query.versionId as string | undefined
      );
      res.json({ success: true, data: sessions });
    } catch (error) {
      next(error);
    }
  };

  getSandboxSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await sandboxService.getSession(req.user!.businessId!, String(req.params.sessionId));
      res.json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  };

  sendSandboxMessage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await sandboxService.sendMessage(
        req.user!.businessId!,
        String(req.params.sessionId),
        req.body.content,
        { userId: req.user!.userId }
      );
      res.json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  };

  getSandboxReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await sandboxService.getTestReport(req.user!.businessId!, String(req.params.sessionId));
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  };

  requestDeployment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await deploymentService.requestDeployment(
        req.user!.businessId!,
        req.body.versionId,
        {
          ...auditFromReq(req),
          deploymentSummary: req.body.deploymentSummary,
          sandboxTestSummary: req.body.sandboxTestSummary,
        }
      );
      res.status(201).json({ success: true, data: request });
    } catch (error) {
      next(error);
    }
  };

  listDeploymentRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requests = await deploymentService.listRequests(req.user!.businessId!);
      res.json({ success: true, data: requests });
    } catch (error) {
      next(error);
    }
  };

  getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const analytics = await aiTrainingAnalyticsService.getAnalytics(req.user!.businessId!);
      res.json({ success: true, data: analytics });
    } catch (error) {
      next(error);
    }
  };

  listInsights = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const insights = await insightsService.listInsights(req.user!.businessId!);
      res.json({ success: true, data: insights });
    } catch (error) {
      next(error);
    }
  };

  resolveInsight = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await insightsService.resolveInsight(req.user!.businessId!, String(req.params.insightId));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const logs = await aiTrainingMgmtService.getAuditLogs(req.user!.businessId!);
      res.json({ success: true, data: logs });
    } catch (error) {
      next(error);
    }
  };
}

export const aiTrainingMgmtController = new AiTrainingMgmtController();
