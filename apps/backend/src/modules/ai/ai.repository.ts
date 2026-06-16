import { prisma } from '../../infrastructure/database/prisma';
import { Prisma } from '@prisma/client';

export class AIRepository {
  async findByBusinessId(businessId: string) {
    return prisma.aIConfiguration.findUnique({
      where: { businessId },
    });
  }

  async upsert(businessId: string, data: Prisma.AIConfigurationUpdateInput) {
    return prisma.aIConfiguration.upsert({
      where: { businessId },
      create: {
        businessId,
        systemPrompt: data.systemPrompt as string | undefined,
        temperature: (data.temperature as number) ?? 0.7,
        maxTokens: (data.maxTokens as number) ?? 500,
        enableAutoReply: (data.enableAutoReply as boolean) ?? true,
        enableBooking: (data.enableBooking as boolean) ?? true,
        enableLeadQualification: (data.enableLeadQualification as boolean) ?? true,
        languages: (data.languages as string[]) ?? ['en'],
        greetingMessage: data.greetingMessage as string | undefined,
        fallbackMessage: data.fallbackMessage as string | undefined,
      },
      update: data,
    });
  }
}

export const aiRepository = new AIRepository();
