import type { PlatformFeatureStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { PLATFORM_FEATURE_REGISTRY } from './feature-registry.data';
import { isSubscriptionFeatureEntitled } from './subscription-feature-entitlements';
import { logger } from '../../core/logger';

const CACHE_TTL_MS = 30_000;

interface FeatureCacheEntry {
  expiresAt: number;
  enabled: boolean;
  status: PlatformFeatureStatus;
}

const featureCache = new Map<string, FeatureCacheEntry>();

function cacheKey(featureKey: string, businessId?: string) {
  return `${featureKey}:${businessId ?? 'global'}`;
}

export function isExecutableStatus(status: PlatformFeatureStatus): boolean {
  return status === 'ENABLED';
}

function getRegistryEntry(featureKey: string) {
  return PLATFORM_FEATURE_REGISTRY.find((entry) => entry.featureKey === featureKey);
}

async function resolveFeatureAccess(
  featureKey: string,
  status: PlatformFeatureStatus,
  businessId?: string
): Promise<{ enabled: boolean; status: PlatformFeatureStatus }> {
  let resolvedStatus = status;
  let enabled = isExecutableStatus(resolvedStatus);

  if (!enabled && businessId) {
    enabled = await isSubscriptionFeatureEntitled(featureKey, businessId);
    if (enabled) resolvedStatus = 'ENABLED';
  }

  return { enabled, status: resolvedStatus };
}

function cacheResolvedFeature(key: string, enabled: boolean, status: PlatformFeatureStatus) {
  featureCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    enabled,
    status,
  });
}

export class FeatureRegistryService {
  invalidateCache(featureKey?: string) {
    if (featureKey) {
      for (const key of featureCache.keys()) {
        if (key.startsWith(`${featureKey}:`)) featureCache.delete(key);
      }
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
          status: entry.status ?? 'DISABLED',
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
    const key = cacheKey(featureKey, businessId);
    const cached = featureCache.get(key);
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
      const registryEntry = getRegistryEntry(featureKey);
      if (registryEntry) {
        const resolved = await resolveFeatureAccess(
          featureKey,
          registryEntry.status ?? 'DISABLED',
          businessId
        );
        cacheResolvedFeature(key, resolved.enabled, resolved.status);
        return resolved.enabled;
      }

      if (businessId && (await isSubscriptionFeatureEntitled(featureKey, businessId))) {
        cacheResolvedFeature(key, true, 'ENABLED');
        return true;
      }

      cacheResolvedFeature(key, false, 'DISABLED');
      return false;
    }

    let status = feature.status;
    if (businessId && feature.scope === 'BUSINESS_SPECIFIC') {
      const scope = Array.isArray(feature.businessScopes)
        ? feature.businessScopes[0]
        : undefined;
      if (scope) status = scope.status;
    }

    const resolved = await resolveFeatureAccess(featureKey, status, businessId);
    cacheResolvedFeature(key, resolved.enabled, resolved.status);
    return resolved.enabled;
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

  async getPublicFeatureMap(businessId?: string) {
    const dbFeatures = await prisma.platformFeature.findMany({
      where: { isNavItem: true },
      select: {
        featureKey: true,
        status: true,
        scope: true,
        routePath: true,
        navLabel: true,
        category: true,
        releaseType: true,
        businessScopes: businessId
          ? { where: { businessId }, take: 1, select: { status: true } }
          : false,
      },
    });
    const dbByKey = new Map(dbFeatures.map((feature) => [feature.featureKey, feature]));

    const map: Record<string, { enabled: boolean; status: PlatformFeatureStatus }> = {};
    const navEntries = PLATFORM_FEATURE_REGISTRY.filter((entry) => entry.isNavItem);

    for (const entry of navEntries) {
      const dbFeature = dbByKey.get(entry.featureKey);
      let status = dbFeature?.status ?? entry.status ?? 'DISABLED';

      if (businessId && dbFeature?.scope === 'BUSINESS_SPECIFIC') {
        const scope = Array.isArray(dbFeature.businessScopes) ? dbFeature.businessScopes[0] : undefined;
        if (scope) status = scope.status;
      }

      const resolved = await resolveFeatureAccess(entry.featureKey, status, businessId);
      map[entry.featureKey] = resolved;
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
