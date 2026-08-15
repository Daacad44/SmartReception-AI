import type { AIConfiguration, Business, KnowledgeBase, WhatsAppAccount } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { NotFoundError } from '../../core/errors';
import { resolveStoredToken } from '../../infrastructure/crypto/token-crypto';
import { logger } from '../../core/logger';
import { phoneLast6 } from '@smartreception/shared';
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
   *
   * Ingestion (storing + displaying the inbound message) must NOT depend on the
   * outbound access token: a missing/undecryptable token here previously threw,
   * which dropped the whole webhook (message never reached the system). We now
   * resolve the tenant even without a usable token — the reply stage handles a
   * missing token gracefully — so inbound messages always land in the inbox.
   */
  async resolveByPhoneNumberId(
    phoneNumberId: string,
    displayPhoneNumber?: string
  ): Promise<WhatsAppTenantContext> {
    let account = await prisma.whatsAppAccount.findUnique({
      where: { phoneNumberId },
      include: { business: true },
    });

    // Fallback: the stored phoneNumberId can be stale/mismatched while the
    // display number still identifies the tenant. Match on the last 6 digits.
    if ((!account || !account.isActive) && displayPhoneNumber) {
      account = await this.findActiveAccountByDisplayNumber(displayPhoneNumber);
      if (account) {
        logger.warn('WhatsApp tenant resolved via display_phone_number fallback', {
          receivedPhoneNumberId: phoneNumberId,
          displayPhoneNumber,
          matchedAccountId: account.id,
          storedPhoneNumberId: account.phoneNumberId,
        });
      }
    }

    if (!account || !account.isActive) {
      const activeIds = await prisma.whatsAppAccount.findMany({
        where: { isActive: true },
        select: { phoneNumberId: true },
      });
      logger.warn('WhatsApp webhook: no active account matched inbound phone_number_id', {
        receivedPhoneNumberId: phoneNumberId,
        displayPhoneNumber,
        knownActivePhoneNumberIds: activeIds.map((a) => a.phoneNumberId),
      });
      throw new NotFoundError(`WhatsApp account not found for phone_number_id: ${phoneNumberId}`);
    }

    const accessToken = resolveStoredToken(account.accessToken);
    if (!accessToken) {
      // Do NOT throw — ingest the message so it shows in the system. The reply
      // stage will surface a token-error notice instead of silently dropping it.
      logger.warn(
        'WhatsApp stored access token missing/undecryptable — ingesting inbound without reply capability',
        { phoneNumberId: account.phoneNumberId, businessId: account.businessId }
      );
    }

    const [aiConfiguration, knowledgeBase] = await Promise.all([
      this.loadAiConfiguration(account.businessId),
      knowledgeRepository.getDefaultBase(account.businessId),
    ]);

    return this.buildContext({
      phoneNumberId: account.phoneNumberId,
      account,
      accessToken: accessToken ?? '',
      aiConfiguration,
      knowledgeBase,
      displayPhoneNumber,
    });
  }

  /** Find an active WhatsApp account whose stored number matches the last 6 digits. */
  private async findActiveAccountByDisplayNumber(
    displayPhoneNumber: string
  ): Promise<WhatsAppAccountWithBusiness | null> {
    const last6 = phoneLast6(displayPhoneNumber);
    if (last6.length < 6) return null;

    const accounts = await prisma.whatsAppAccount.findMany({
      where: { isActive: true },
      include: { business: true },
    });

    return (
      accounts.find(
        (a) =>
          phoneLast6(a.phoneNumber ?? '') === last6 ||
          phoneLast6(a.phoneNumberId ?? '') === last6
      ) ?? null
    );
  }

  async resolveInbound(
    metadata: WebhookMetadata,
    senderPhone: string
  ): Promise<WhatsAppTenantContext> {
    const phoneNumberId = metadata.phone_number_id?.trim();
    if (!phoneNumberId) {
      throw new NotFoundError('Webhook missing phone_number_id');
    }

    const context = await this.resolveByPhoneNumberId(phoneNumberId, metadata.display_phone_number);
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
