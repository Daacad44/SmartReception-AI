import { Prisma } from '@prisma/client';
import { ValidationError } from '../../core/errors';
import { prisma } from '../../infrastructure/database/prisma';

const json = (value: unknown) => value as Prisma.InputJsonValue;

export function compareVersions(left: string, right: string) {
  const a = left.split('.').map((part) => Number(part) || 0);
  const b = right.split('.').map((part) => Number(part) || 0);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) return (a[index] ?? 0) - (b[index] ?? 0);
  }
  return 0;
}

export class SystemUpdatesService {
  async getStatus(businessId: string) {
    const state = await prisma.businessSystemUpdateState.upsert({
      where: { businessId },
      create: { businessId, installedVersion: '1.1.1', lastCheckedAt: new Date() },
      update: { lastCheckedAt: new Date() },
    });
    const [releases, history] = await Promise.all([
      prisma.platformSystemRelease.findMany({ orderBy: { publishedAt: 'asc' } }),
      prisma.businessSystemUpdateInstallation.findMany({ where: { businessId }, include: { release: true }, orderBy: { installedAt: 'desc' }, take: 50 }),
    ]);
    const available = releases.filter((release) => compareVersions(release.version, state.installedVersion) > 0);
    return { state, currentVersion: state.installedVersion, latestVersion: releases.at(-1)?.version ?? state.installedVersion, updateAvailable: available.length > 0, available, history };
  }

  async applyAll(businessId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`system-update:${businessId}`}))`;
      const state = await tx.businessSystemUpdateState.upsert({ where: { businessId }, create: { businessId, installedVersion: '1.1.1' }, update: {} });
      const releases = await tx.platformSystemRelease.findMany({ orderBy: { publishedAt: 'asc' } });
      const available = releases.filter((release) => compareVersions(release.version, state.installedVersion) > 0);
      let installedVersion = state.installedVersion;
      const installed: string[] = [];
      for (const release of available) {
        if (release.minimumVersion && compareVersions(installedVersion, release.minimumVersion) < 0) {
          throw new ValidationError(`Version ${release.version} requires ${release.minimumVersion} or newer`);
        }
        await tx.businessSystemUpdateInstallation.upsert({
          where: { businessId_releaseId: { businessId, releaseId: release.id } },
          create: { businessId, releaseId: release.id, fromVersion: installedVersion, toVersion: release.version, installedByUserId: userId },
          update: {},
        });
        installedVersion = release.version;
        installed.push(release.version);
      }
      if (installed.length) {
        await tx.businessSystemUpdateState.update({ where: { businessId }, data: { installedVersion, lastUpdatedAt: new Date(), lastCheckedAt: new Date(), updatedByUserId: userId } });
        await tx.auditLog.create({ data: { businessId, userId, action: 'UPDATE', entity: 'BusinessSystemUpdateState', entityId: state.id, newData: json({ fromVersion: state.installedVersion, toVersion: installedVersion, installed }) } });
      }
      return { updated: installed.length > 0, fromVersion: state.installedVersion, installedVersion, installed };
    });
  }
}

export const systemUpdatesService = new SystemUpdatesService();
