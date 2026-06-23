import { prisma } from '../../infrastructure/database/prisma';
import { SMARTRECEPTION_SYSTEM_PROMPT } from '../../infrastructure/ai/smartreception-knowledge';
import { SMARTRECEPTION_SERVICE_MENU } from '../../infrastructure/ai/somali-menu';

const AI_CONFIG_CACHE_TTL_MS = 60_000;
const autoReplyCache = new Map<string, { enabled: boolean; loadedAt: number }>();

export function invalidateAiConfigCache(businessId: string): void {
  autoReplyCache.delete(businessId);
}

/** Ensure AI configuration exists with auto-reply enabled (hybrid default). */
export async function ensureAiConfiguration(businessId: string) {
  return prisma.aIConfiguration.upsert({
    where: { businessId },
    create: {
      businessId,
      systemPrompt: SMARTRECEPTION_SYSTEM_PROMPT,
      greetingMessage: SMARTRECEPTION_SERVICE_MENU,
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
