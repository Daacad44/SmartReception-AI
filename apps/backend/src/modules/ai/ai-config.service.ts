import { prisma } from '../../infrastructure/database/prisma';
import { SMARTRECEPTION_SYSTEM_PROMPT } from '../../infrastructure/ai/smartreception-knowledge';
import { SMARTRECEPTION_SERVICE_MENU } from '../../infrastructure/ai/somali-menu';

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

export async function isAutoReplyEnabled(businessId: string): Promise<boolean> {
  const config = await ensureAiConfiguration(businessId);
  return config.enableAutoReply;
}
