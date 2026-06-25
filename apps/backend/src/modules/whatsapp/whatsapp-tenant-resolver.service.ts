import type { AIConfiguration, Business, KnowledgeBase, WhatsAppAccount } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../core/errors';
import { knowledgeRepository } from '../knowledge/knowledge.repository';
import type { WebhookMetadata, WhatsAppTenantContext } from './whatsapp-tenant.types';

type WhatsAppAccountWithBusiness = WhatsAppAccount & { business: Business };

export function extractWebhookMetadata(value: Record<string, unknown>): WebhookMetadata {
  const metadata = value.metadata as WebhookMetadata | undefined;
  return {
    phone_number_id: metadata?.phone_number_id,
    display_phone_number: metadata?.display_phone_number,
  };
}

export class WhatsAppTenantResolver {
  /**
   * Resolve tenant by Meta phone_number_id.
   * Never falls back to a default workspace or global assistant.
   */
  async resolveByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppTenantContext> {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { phoneNumberId, isActive: true },
      include: { business: true },
    });

    if (!account) {
      throw new NotFoundError(`WhatsApp account not found for phone_number_id: ${phoneNumberId}`);
    }

    if (!account.accessToken?.trim()) {
      throw new NotFoundError(
        `WhatsApp access token not configured for phone_number_id: ${phoneNumberId}`
      );
    }

    const [aiConfiguration, knowledgeBase] = await Promise.all([
      this.loadAiConfiguration(account.businessId),
      knowledgeRepository.getDefaultBase(account.businessId),
    ]);

    return this.buildContext({
      phoneNumberId,
      account,
      accessToken: account.accessToken.trim(),
      aiConfiguration,
      knowledgeBase,
    });
  }

  async resolveInbound(
    metadata: WebhookMetadata,
    senderPhone: string
  ): Promise<WhatsAppTenantContext> {
    const phoneNumberId = metadata.phone_number_id?.trim();
    if (!phoneNumberId) {
      throw new NotFoundError('Webhook missing phone_number_id');
    }

    const context = await this.resolveByPhoneNumberId(phoneNumberId);
    return {
      ...context,
      displayPhoneNumber: metadata.display_phone_number,
      senderPhone,
    };
  }

  private async loadAiConfiguration(businessId: string): Promise<AIConfiguration> {
    const existing = await prisma.aIConfiguration.findUnique({ where: { businessId } });
    if (existing) return existing;

    return prisma.aIConfiguration.create({
      data: { businessId },
    });
  }

  private buildContext(params: {
    phoneNumberId: string;
    account: WhatsAppAccountWithBusiness;
    accessToken: string;
    aiConfiguration: AIConfiguration;
    knowledgeBase: KnowledgeBase | null;
    displayPhoneNumber?: string;
    senderPhone?: string;
  }): WhatsAppTenantContext {
    return {
      phoneNumberId: params.phoneNumberId,
      displayPhoneNumber: params.displayPhoneNumber,
      senderPhone: params.senderPhone ?? '',
      account: params.account,
      business: params.account.business,
      businessId: params.account.businessId,
      accessToken: params.accessToken,
      aiConfiguration: params.aiConfiguration,
      knowledgeBase: params.knowledgeBase,
    };
  }
}

export const whatsappTenantResolver = new WhatsAppTenantResolver();
