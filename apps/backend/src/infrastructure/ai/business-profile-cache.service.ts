import type { BusinessProfile } from '@prisma/client';
import { prisma } from '../database/prisma';

const CACHE_TTL_MS = 60_000;
const profileCache = new Map<string, { profile: BusinessProfile; loadedAt: number }>();

export function invalidateBusinessProfileCache(businessId: string): void {
  profileCache.delete(businessId);
}

export async function getCachedBusinessProfileRecord(businessId: string): Promise<BusinessProfile | null> {
  const cached = profileCache.get(businessId);
  const now = Date.now();
  if (cached && now - cached.loadedAt < CACHE_TTL_MS) {
    return cached.profile;
  }

  const profile = await prisma.businessProfile.findUnique({ where: { businessId } });
  if (profile) {
    profileCache.set(businessId, { profile, loadedAt: now });
  }
  return profile;
}

/** Ensure a profile row exists, seeded from Business table fields. */
export async function ensureBusinessProfile(businessId: string): Promise<BusinessProfile> {
  const existing = await prisma.businessProfile.findUnique({ where: { businessId } });
  if (existing) return existing;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      description: true,
      industry: true,
      businessCategory: true,
      businessType: true,
      phone: true,
      email: true,
      website: true,
      address: true,
      country: true,
      city: true,
      whatsappNumber: true,
      logoUrl: true,
    },
  });
  if (!business) throw new Error(`Business not found: ${businessId}`);

  const profile = await prisma.businessProfile.create({
    data: {
      businessId,
      businessName: business.name,
      logoUrl: business.logoUrl,
      businessCategory: business.businessCategory ?? business.businessType,
      industryLabel: business.industry,
      businessDescription: business.description,
      companyOverview: business.description,
      aboutUs: business.description,
      shortIntroduction: business.description,
      website: business.website,
      email: business.email,
      phone: business.phone,
      whatsapp: business.whatsappNumber ?? business.phone,
      address: business.address,
      country: business.country,
      city: business.city,
      languages: ['so', 'en'],
    },
  });

  profileCache.set(businessId, { profile, loadedAt: Date.now() });
  return profile;
}
