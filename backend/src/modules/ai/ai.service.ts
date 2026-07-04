import { aiRepository } from './ai.repository';
import { NotFoundError } from '../../core/errors';
import { AiConfigInput } from '@smartreception/shared';
import { prisma } from '../../infrastructure/database/prisma';

export class AIService {
  async getConfig(businessId: string) {
    const config = await aiRepository.findByBusinessId(businessId);
    if (!config) {
      throw new NotFoundError('AI configuration not found');
    }
    return config;
  }

  async updateConfig(businessId: string, input: AiConfigInput, userId: string) {
    const config = await aiRepository.upsert(businessId, input);

    await prisma.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'UPDATE',
        entity: 'AIConfiguration',
        entityId: config.id,
        newData: input as object,
      },
    });

    return config;
  }
}

export const aiService = new AIService();
