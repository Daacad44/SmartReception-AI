import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../core/errors';
import {
  ensureBusinessProfile,
  getCachedBusinessProfileRecord,
  invalidateBusinessProfileCache,
} from '../../infrastructure/ai/business-profile-cache.service';
import { processBusinessProfilePdf } from '../../infrastructure/ai/business-profile-extraction.service';
import { invalidateBusinessTenantCache } from '../../infrastructure/ai/business-tenant-cache.service';
import { syncBusinessIdentity } from '../../infrastructure/ai/business-identity-sync.service';
import { storageService } from '../../infrastructure/storage';
import { logger } from '../../core/logger';
import type { Prisma } from '@prisma/client';
import type { UpdateBusinessProfileInput } from '@smartreception/shared';

export type { UpdateBusinessProfileInput };

export class BusinessProfileService {
  async get(businessId: string) {
    return ensureBusinessProfile(businessId);
  }

  /**
   * Persist Business Profile edits.
   *
   * The frontend PATCHes the entire form back, so unset fields arrive as `null`.
   * Prisma treats `undefined` as "skip" and `null` as "clear the column", which
   * is exactly the semantics we want — only fields the user actually touched (or
   * cleared) are written. We drop `undefined` keys so unrelated columns are never
   * rewritten, then refresh every AI cache so the change is live immediately.
   */
  async update(businessId: string, input: UpdateBusinessProfileInput) {
    await ensureBusinessProfile(businessId);

    const data: Prisma.BusinessProfileUpdateInput = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        (data as Record<string, unknown>)[key] = value;
      }
    }

    const profile = await prisma.businessProfile.update({
      where: { businessId },
      data,
    });

    await this.refreshAiContext(businessId);
    return profile;
  }

  /**
   * Business Profile IS the AI's memory. After any change we invalidate the
   * profile, tenant and knowledge caches (Redis + in-process) and re-sync the
   * business identity so prompts, welcome messages and the appointment engine
   * pick up the new data on the very next message — no manual refresh.
   */
  private async refreshAiContext(businessId: string) {
    invalidateBusinessProfileCache(businessId);
    invalidateBusinessTenantCache(businessId);
    try {
      await syncBusinessIdentity(businessId);
    } catch (error) {
      logger.warn('Business identity sync after profile update failed', {
        businessId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async uploadPdf(businessId: string, buffer: Buffer, filename: string) {
    await ensureBusinessProfile(businessId);
    const stored = await storageService.upload(
      buffer,
      filename,
      'application/pdf',
      `business-profile/${businessId}`
    );

    await prisma.businessProfile.update({
      where: { businessId },
      data: {
        profilePdfUrl: stored.url,
        profilePdfFilename: filename,
        extractionStatus: 'PENDING',
        extractionError: null,
      },
    });

    invalidateBusinessProfileCache(businessId);

    void processBusinessProfilePdf(businessId).catch(() => undefined);

    return getCachedBusinessProfileRecord(businessId);
  }

  async reprocessPdf(businessId: string) {
    const profile = await prisma.businessProfile.findUnique({ where: { businessId } });
    if (!profile?.profilePdfUrl) throw new NotFoundError('No Business Profile PDF uploaded');
    await processBusinessProfilePdf(businessId);
    return ensureBusinessProfile(businessId);
  }

  async deletePdf(businessId: string) {
    const profile = await prisma.businessProfile.findUnique({ where: { businessId } });
    if (!profile) return;

    if (profile.profilePdfUrl) {
      try {
        await storageService.delete(profile.profilePdfUrl);
      } catch {
        // PDF may already be removed from storage
      }
    }

    await prisma.businessProfile.update({
      where: { businessId },
      data: {
        profilePdfUrl: null,
        profilePdfFilename: null,
        extractionStatus: 'NONE',
        extractionError: null,
        extractedAt: null,
      },
    });
    invalidateBusinessProfileCache(businessId);
    invalidateBusinessTenantCache(businessId);
  }

  /** Delete entire Business Profile for this business only (not Knowledge Base). */
  async clearProfile(businessId: string) {
    const profile = await prisma.businessProfile.findUnique({ where: { businessId } });
    if (!profile) return { deleted: false };

    if (profile.profilePdfUrl) {
      try {
        await storageService.delete(profile.profilePdfUrl);
      } catch {
        // Best-effort storage cleanup
      }
    }

    await prisma.businessProfile.delete({ where: { businessId } });
    invalidateBusinessProfileCache(businessId);
    invalidateBusinessTenantCache(businessId);

    await ensureBusinessProfile(businessId);
    await syncBusinessIdentity(businessId);

    return { deleted: true };
  }
}

export const businessProfileService = new BusinessProfileService();
