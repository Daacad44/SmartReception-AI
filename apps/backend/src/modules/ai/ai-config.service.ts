import { prisma } from '../../infrastructure/database/prisma';
import {
  buildDefaultGreetingMessage,
  buildDefaultSystemPrompt,
} from '../../infrastructure/ai/smartreception-tenant';

const AI_CONFIG_CACHE_TTL_MS = 60_000;
const autoReplyCache = new Map<string, { enabled: boolean; loadedAt: number }>();

export function invalidateAiConfigCache(businessId: string): void {
  autoReplyCache.delete(businessId);
}

/** Ensure AI configuration exists with business-scoped defaults (never SmartReception platform copy). */
export async function ensureAiConfiguration(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true },
  });
  if (!business) {
    throw new Error(`Business not found: ${businessId}`);
  }

  return prisma.aIConfiguration.upsert({
    where: { businessId },
    create: {
      businessId,
      systemPrompt: buildDefaultSystemPrompt(business.name),
      greetingMessage: buildDefaultGreetingMessage(business.name),
      enableAutoReply: true,
      enableBooking: true,
      enableLeadQualification: true,
      languages: ['so', 'en'],
    },
    update: {},
  });
}

/** Fast read on the hot path — no upsert. Defaults to enabled when unset. */
export async function isAutoReplyEnabled(businessId: string): Promise<boolean> {
  const cached = autoReplyCache.get(businessId);
  const now = Date.now();
  if (cached && now - cached.loadedAt < AI_CONFIG_CACHE_TTL_MS) {
    return cached.enabled;
  }

  const row = await prisma.aIConfiguration.findUnique({
    where: { businessId },
    select: { enableAutoReply: true },
  });
  const enabled = row?.enableAutoReply ?? true;
  autoReplyCache.set(businessId, { enabled, loadedAt: now });
  return enabled;
}
