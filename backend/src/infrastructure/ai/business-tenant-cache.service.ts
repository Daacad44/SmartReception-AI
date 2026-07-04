import type { AIConfiguration, Business, Service } from '@prisma/client';
import { prisma } from '../database/prisma';
import { invalidateKnowledgeCache } from './knowledge-search.service';
import { invalidateBusinessProfileCache } from './business-profile-cache.service';

const CACHE_TTL_MS = 60_000;

type CachedProfile = {
  business: Pick<
    Business,
    | 'id'
    | 'name'
    | 'slug'
    | 'description'
    | 'industry'
    | 'businessType'
    | 'businessCategory'
    | 'phone'
    | 'website'
    | 'city'
    | 'country'
  >;
  services: Array<Pick<Service, 'id' | 'name' | 'description' | 'price'>>;
  aiConfiguration: AIConfiguration | null;
  loadedAt: number;
};

const profileCache = new Map<string, CachedProfile>();

export function invalidateBusinessTenantCache(businessId: string): void {
  profileCache.delete(businessId);
  invalidateKnowledgeCache(businessId);
  invalidateBusinessProfileCache(businessId);
}

/** Load business profile + services + AI config in one scoped query batch. */
export async function getCachedBusinessProfile(businessId: string): Promise<CachedProfile> {
  const cached = profileCache.get(businessId);
  const now = Date.now();
  if (cached && now - cached.loadedAt < CACHE_TTL_MS) {
    return cached;
  }

  const [business, services, aiConfiguration] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        industry: true,
        businessType: true,
        businessCategory: true,
        phone: true,
        website: true,
        city: true,
        country: true,
      },
    }),
    prisma.service.findMany({
      where: { businessId, isActive: true },
      orderBy: { createdAt: 'asc' },
      take: 12,
      select: { id: true, name: true, description: true, price: true },
    }),
    prisma.aIConfiguration.findUnique({ where: { businessId } }),
  ]);

  if (!business) {
    throw new Error(`Business not found: ${businessId}`);
  }

  const profile: CachedProfile = { business, services, aiConfiguration, loadedAt: now };
  profileCache.set(businessId, profile);
  return profile;
}
