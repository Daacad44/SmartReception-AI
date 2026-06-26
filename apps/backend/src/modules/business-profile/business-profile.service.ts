import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../core/errors';
import {
  ensureBusinessProfile,
  getCachedBusinessProfileRecord,
  invalidateBusinessProfileCache,
} from '../../infrastructure/ai/business-profile-cache.service';
import { processBusinessProfilePdf } from '../../infrastructure/ai/business-profile-extraction.service';
import { invalidateBusinessTenantCache } from '../../infrastructure/ai/business-tenant-cache.service';
import { storageService } from '../../infrastructure/storage';
import type { Prisma } from '@prisma/client';

export type UpdateBusinessProfileInput = {
  businessName?: string;
  logoUrl?: string;
  businessCategory?: string;
  industryLabel?: string;
  companyOverview?: string;
  aboutUs?: string;
  mission?: string;
  vision?: string;
  coreValues?: string[];
  businessDescription?: string;
  founder?: string;
  website?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  country?: string;
  city?: string;
  workingHours?: string;
  googleMapsUrl?: string;
  socialMedia?: Record<string, string>;
  yearsInBusiness?: number;
  certifications?: string[];
  awards?: string[];
  brandTone?: string;
  languages?: string[];
  callToAction?: string;
  whyChooseUs?: string;
  companyIntroduction?: string;
  companySummary?: string;
  shortIntroduction?: string;
  longIntroduction?: string;
};

export class BusinessProfileService {
  async get(businessId: string) {
    return ensureBusinessProfile(businessId);
  }

  async update(businessId: string, input: UpdateBusinessProfileInput) {
    await ensureBusinessProfile(businessId);
    const data: Prisma.BusinessProfileUpdateInput = {
      ...input,
      coreValues: input.coreValues,
      socialMedia: input.socialMedia,
      certifications: input.certifications,
      awards: input.awards,
      languages: input.languages,
    };

    const profile = await prisma.businessProfile.update({
      where: { businessId },
      data,
    });

    invalidateBusinessProfileCache(businessId);
    invalidateBusinessTenantCache(businessId);
    return profile;
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

    return { deleted: true };
  }
}

export const businessProfileService = new BusinessProfileService();
