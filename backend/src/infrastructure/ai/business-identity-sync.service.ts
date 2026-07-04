import { prisma } from '../database/prisma';
import {
  buildDefaultGreetingMessage,
  buildDefaultSystemPrompt,
} from './smartreception-tenant';
import { invalidateBusinessProfileCache } from './business-profile-cache.service';
import { invalidateBusinessTenantCache } from './business-tenant-cache.service';
import { invalidateAiConfigCache } from '../../modules/ai/ai-config.service';
import {
  isGenericEnglishGreeting,
  isPredominantlyEnglish,
} from './business-language.util';

const LEGACY_IDENTITY_NAMES = new Set(['smartreception ai', 'smartreception']);

function normalizeName(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function isLegacyIdentityName(value: string | null | undefined): boolean {
  return LEGACY_IDENTITY_NAMES.has(normalizeName(value));
}

/** Keep Business Profile + AI greeting aligned with the workspace Business record. */
export async function syncBusinessIdentity(
  businessId: string,
  previousName?: string
): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, description: true },
  });
  if (!business) return;

  const profile = await prisma.businessProfile.findUnique({ where: { businessId } });
  if (profile) {
    const profileName = profile.businessName?.trim();
    const shouldSyncProfileName =
      !profileName ||
      (previousName && profileName === previousName) ||
      isLegacyIdentityName(profileName) ||
      profileName !== business.name;

    if (shouldSyncProfileName) {
      await prisma.businessProfile.update({
        where: { businessId },
        data: { businessName: business.name },
      });
    }
  }

  const aiConfig = await prisma.aIConfiguration.findUnique({ where: { businessId } });
  if (aiConfig) {
    const greeting = aiConfig.greetingMessage?.trim();
    const systemPrompt = aiConfig.systemPrompt?.trim();
    const updates: { greetingMessage?: string; systemPrompt?: string } = {};

    const staleGreeting =
      !greeting ||
      isGenericEnglishGreeting(greeting) ||
      isPredominantlyEnglish(greeting) ||
      (previousName && greeting.includes(previousName)) ||
      isLegacyIdentityName(greeting);

    if (staleGreeting) {
      updates.greetingMessage = buildDefaultGreetingMessage(business.name);
    }

    const stalePrompt =
      !systemPrompt ||
      (previousName && systemPrompt.includes(previousName)) ||
      isLegacyIdentityName(systemPrompt);

    if (stalePrompt) {
      updates.systemPrompt = buildDefaultSystemPrompt(business.name);
    }

    if (Object.keys(updates).length > 0) {
      await prisma.aIConfiguration.update({
        where: { businessId },
        data: updates,
      });
    }
  }

  invalidateBusinessProfileCache(businessId);
  invalidateBusinessTenantCache(businessId);
  invalidateAiConfigCache(businessId);
}
