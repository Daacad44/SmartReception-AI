import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { PlatformFeatureStatus } from '@prisma/client';
import { featureRegistryService } from './feature-registry.service';
import { featureVerificationService } from './feature-verification.service';
import { FEATURE_CATEGORIES } from './feature-registry.data';
import { prisma } from '../../infrastructure/database/prisma';

const statusSchema = z.enum([
  'DISABLED',
  'ENABLED',
  'HIDDEN',
  'INTERNAL',
  'BETA',
  'COMING_SOON',
  'EXPERIMENTAL',
  'DEPRECATED',
  'ARCHIVED',
]);

const requestActivationSchema = z.object({
  featureId: z.string().uuid(),
  targetStatus: statusSchema,
  reason: z.string().max(500).optional(),
});

const verifySchema = z.object({
  requestId: z.string().uuid(),
  code: z.string().length(6),
});

export class FeatureManagementController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const category = req.query.category as string | undefined;
      const status = req.query.status as PlatformFeatureStatus | undefined;
      const releaseType = req.query.releaseType as string | undefined;
      const search = req.query.search as string | undefined;

      const features = await featureRegistryService.listFeatures({
        category,
        status,
        releaseType,
        search,
      });

      res.json({
        success: true,
        data: {
          features,
          categories: FEATURE_CATEGORIES,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const feature = await featureRegistryService.getFeatureById(String(req.params.id));
      if (!feature) {
        res.status(404).json({ success: false, message: 'Feature not found' });
        return;
      }
      res.json({ success: true, data: feature });
    } catch (error) {
      next(error);
    }
  }

  async publicMap(req: Request, res: Response, next: NextFunction) {
    try {
      const map = await featureRegistryService.getPublicFeatureMap(req.user?.businessId);
      res.json({ success: true, data: map });
    } catch (error) {
      next(error);
    }
  }

  async auditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const featureId = req.query.featureId as string | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const logs = await featureRegistryService.listAuditLogs({ featureId, limit, offset });
      res.json({ success: true, data: logs });
    } catch (error) {
      next(error);
    }
  }

  async requestActivation(req: Request, res: Response, next: NextFunction) {
    try {
      const body = requestActivationSchema.parse(req.body);
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { email: true, firstName: true, isSuperAdmin: true },
      });

      if (!user?.isSuperAdmin) {
        res.status(403).json({ success: false, message: 'Super Admin access required' });
        return;
      }

      const result = await featureVerificationService.requestActivation({
        userId: req.user!.userId,
        email: user.email,
        firstName: user.firstName,
        featureId: body.featureId,
        targetStatus: body.targetStatus,
        reason: body.reason,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async verifyActivation(req: Request, res: Response, next: NextFunction) {
    try {
      const body = verifySchema.parse(req.body);
      const result = await featureVerificationService.verifyAndApply(
        body.requestId,
        body.code,
        req.user!.userId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async cancelVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await featureVerificationService.cancelVerification(
        String(req.params.requestId),
        req.user!.userId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async stats(_req: Request, res: Response, next: NextFunction) {
    try {
      const [total, enabled, disabled, future] = await Promise.all([
        prisma.platformFeature.count(),
        prisma.platformFeature.count({ where: { status: 'ENABLED' } }),
        prisma.platformFeature.count({ where: { status: 'DISABLED' } }),
        prisma.platformFeature.count({ where: { releaseType: 'FUTURE' } }),
      ]);

      res.json({
        success: true,
        data: { total, enabled, disabled, future },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const featureManagementController = new FeatureManagementController();
