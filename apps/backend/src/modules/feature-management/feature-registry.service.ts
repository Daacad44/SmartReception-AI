import type { PlatformFeatureStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { PLATFORM_FEATURE_REGISTRY } from './feature-registry.data';
import { logger } from '../../core/logger';

const CACHE_TTL_MS = 30_000;

interface FeatureCacheEntry {
  expiresAt: number;
  enabled: boolean;
  status: PlatformFeatureStatus;
}

const featureCache = new Map<string, FeatureCacheEntry>();

export function isExecutableStatus(status: PlatformFeatureStatus): boolean {
  return status === 'ENABLED';
}

export class FeatureRegistryService {
  invalidateCache(featureKey?: string) {
    if (featureKey) {
      featureCache.delete(featureKey);
      return;
    }
    featureCache.clear();
  }

  async seedRegistry() {
    const keyToId = new Map<string, string>();

    for (const entry of PLATFORM_FEATURE_REGISTRY) {
      const feature = await prisma.platformFeature.upsert({
        where: { featureKey: entry.featureKey },
        create: {
          featureKey: entry.featureKey,
          name: entry.name,
          description: entry.description,
          category: entry.category,
          version: entry.version ?? '1.0.0',
          module: entry.module,
          status: entry.status ?? 'DISABLED',
          releaseType: entry.releaseType ?? 'STANDARD',
          routePath: entry.routePath,
          apiPrefix: entry.apiPrefix,
          navLabel: entry.navLabel,
          isNavItem: entry.isNavItem ?? false,
          blocksAi: entry.blocksAi ?? false,
          blocksJobs: entry.blocksJobs ?? false,
        },
        update: {
          name: entry.name,
          description: entry.description,
          category: entry.category,
          version: entry.version ?? '1.0.0',
          module: entry.module,
          routePath: entry.routePath,
          apiPrefix: entry.apiPrefix,
          navLabel: entry.navLabel,
          isNavItem: entry.isNavItem ?? false,
          blocksAi: entry.blocksAi ?? false,
          blocksJobs: entry.blocksJobs ?? false,
          releaseType: entry.releaseType ?? 'STANDARD',
        },
      });
      keyToId.set(entry.featureKey, feature.id);
    }

    for (const entry of PLATFORM_FEATURE_REGISTRY) {
      if (!entry.dependsOn?.length) continue;
      const featureId = keyToId.get(entry.featureKey);
      if (!featureId) continue;

      for (const depKey of entry.dependsOn) {
        const dependsOnId = keyToId.get(depKey);
        if (!dependsOnId) continue;

        await prisma.platformFeatureDependency.upsert({
          where: {
            featureId_dependsOnFeatureId: {
              featureId,
              dependsOnFeatureId: dependsOnId,
            },
          },
          create: { featureId, dependsOnFeatureId: dependsOnId },
          update: {},
        });
      }
    }

    this.invalidateCache();
    logger.info('Platform feature registry seeded', { count: PLATFORM_FEATURE_REGISTRY.length });
  }

  async isFeatureEnabled(featureKey: string, businessId?: string): Promise<boolean> {
    const cached = featureCache.get(featureKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.enabled;
    }

    const feature = await prisma.platformFeature.findUnique({
      where: { featureKey },
      include: {
        businessScopes: businessId
          ? { where: { businessId }, take: 1 }
          : false,
      },
    });

    if (!feature) {
      featureCache.set(featureKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        enabled: false,
        status: 'DISABLED',
      });
      return false;
    }

    let status = feature.status;
    if (businessId && feature.scope === 'BUSINESS_SPECIFIC') {
      const scope = Array.isArray(feature.businessScopes)
        ? feature.businessScopes[0]
        : undefined;
      if (scope) status = scope.status;
    }

    const enabled = isExecutableStatus(status);
    featureCache.set(featureKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      enabled,
      status,
    });
    return enabled;
  }

  async getFeatureStatus(featureKey: string): Promise<PlatformFeatureStatus | null> {
    const feature = await prisma.platformFeature.findUnique({
      where: { featureKey },
      select: { status: true },
    });
    return feature?.status ?? null;
  }

  async getDependencyWarnings(featureId: string, targetStatus: PlatformFeatureStatus) {
    if (!isExecutableStatus(targetStatus)) return [];

    const deps = await prisma.platformFeatureDependency.findMany({
      where: { featureId },
      include: { dependsOnFeature: true },
    });

    return deps
      .filter((d) => !isExecutableStatus(d.dependsOnFeature.status))
      .map((d) => ({
        featureKey: d.dependsOnFeature.featureKey,
        name: d.dependsOnFeature.name,
        status: d.dependsOnFeature.status,
      }));
  }

  async listFeatures(params?: {
    category?: string;
    status?: PlatformFeatureStatus;
    releaseType?: string;
    search?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (params?.category) where.category = params.category;
    if (params?.status) where.status = params.status;
    if (params?.releaseType) where.releaseType = params.releaseType;
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { featureKey: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return prisma.platformFeature.findMany({
      where,
      include: {
        dependencies: {
          include: { dependsOnFeature: { select: { featureKey: true, name: true, status: true } } },
        },
        _count: { select: { auditLogs: true } },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async getPublicFeatureMap() {
    const features = await prisma.platformFeature.findMany({
      where: { isNavItem: true },
      select: {
        featureKey: true,
        status: true,
        routePath: true,
        navLabel: true,
        category: true,
        releaseType: true,
      },
    });

    const map: Record<string, { enabled: boolean; status: PlatformFeatureStatus }> = {};
    for (const f of features) {
      map[f.featureKey] = {
        enabled: isExecutableStatus(f.status),
        status: f.status,
      };
    }
    return map;
  }

  async getFeatureById(id: string) {
    return prisma.platformFeature.findUnique({
      where: { id },
      include: {
        dependencies: {
          include: { dependsOnFeature: { select: { id: true, featureKey: true, name: true, status: true } } },
        },
        dependents: {
          include: { feature: { select: { id: true, featureKey: true, name: true, status: true } } },
        },
      },
    });
  }

  async listAuditLogs(params: { featureId?: string; limit?: number; offset?: number }) {
    return prisma.platformFeatureAuditLog.findMany({
      where: params.featureId ? { featureId: params.featureId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
      include: {
        superAdmin: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }
}

export const featureRegistryService = new FeatureRegistryService();
