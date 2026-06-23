import crypto from 'crypto';
import { whatsappRepository } from './whatsapp.repository';
import { whatsappService,
  parseWebhookBody,
  extractMessageContent,
  resolveContactName,
} from '../../infrastructure/whatsapp/whatsapp.service';
import { getAiQueue, getWhatsappQueue } from '../../infrastructure/queue/queues';
import { config } from '../../config';
import { prisma } from '../../infrastructure/database/prisma';
import { logger } from '../../core/logger';
import { ConnectWhatsAppInput } from '@smartreception/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors';
import { getAiHealth } from '../../infrastructure/ai/ai-health.service';
import { getPipelineState } from './whatsapp-pipeline-state';
import { handleIncomingMessage } from './incoming-message.service';
import { ensureAiConfiguration } from '../ai/ai-config.service';
import { encryptToken, resolveStoredToken } from '../../infrastructure/crypto/token-crypto';
import { startPipelineTrace } from './message-pipeline.logger';

export interface WhatsAppHealth {
  connection: 'connected' | 'disconnected';
  webhook: 'verified' | 'pending' | 'not_configured';
  phoneStatus: 'active' | 'unknown' | 'inactive';
  phoneNumber: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  businessName: string | null;
  tokenStatus: 'valid' | 'invalid' | 'not_configured';
  lastSync: string | null;
  lastWebhookReceived: string | null;
  lastIncomingMessage: string | null;
  lastOutgoingMessage: string | null;
  envConfigured: boolean;
}

export interface WhatsAppWebhookHealth {
  verified: boolean;
  receivingEvents: boolean;
  lastWebhookReceived: string | null;
  status: 'verified' | 'pending' | 'not_configured';
}

export interface WhatsAppDebugInfo {
  webhook: 'verified' | 'pending' | 'not_configured';
  token: 'valid' | 'invalid' | 'not_configured';
  phone_status: 'active' | 'unknown' | 'inactive';
  ai_status: 'active' | 'misconfigured' | 'degraded' | 'inactive';
  last_incoming_message: string | null;
  last_outgoing_message: string | null;
  last_graph_api_response: string | null;
  last_graph_api_error: string | null;
  lastWebhookReceived: string | null;
  lastMessageProcessed: string | null;
  totalMessages: number;
  totalCustomers: number;
  totalConversations: number;
  webhookStatus: 'verified' | 'pending' | 'not_configured';
}

export interface WhatsAppSendStatus {
  lastInboundMessage: string | null;
  lastOutboundAttempt: string | null;
  lastOutboundSuccess: string | null;
  pendingQueueJobs: number;
  failedJobs: number;
}

export class WhatsAppModuleService {
  private getAccountToken(accessToken?: string | null): string | undefined {
    return resolveStoredToken(accessToken) || config.whatsapp.accessToken || undefined;
  }

  private async setBusinessWhatsAppStatus(
    businessId: string,
    status: 'CONNECTED' | 'NOT_CONNECTED'
  ): Promise<void> {
    await prisma.business.update({
      where: { id: businessId },
      data: { whatsappStatus: status },
    });
  }
  private logWebhookPayload(body: Record<string, unknown>, parsed: ReturnType<typeof parseWebhookBody>) {
    console.log('[WhatsApp] Webhook payload:', JSON.stringify(body));

    for (const msg of parsed.messages) {
      const contactName = resolveContactName(parsed.contacts, msg.from);
      const extracted = extractMessageContent(msg);
      console.log('[WhatsApp] Message parsed:', extracted.type, extracted.content);
    }

    for (const status of parsed.statuses) {
      console.log('[WhatsApp] Status update:', status.status, 'for', status.recipient_id);
    }
  }
  private isWebhookInfrastructureReady(): boolean {
    return Boolean(config.whatsapp.verifyToken && config.whatsapp.webhookUrl);
  }

  private resolveWebhookStatus(input: {
    webhookVerified: boolean;
    receivingEvents: boolean;
    infrastructureReady: boolean;
  }): WhatsAppWebhookHealth['status'] {
    if (!input.infrastructureReady) {
      return 'not_configured';
    }
    if (input.webhookVerified || input.receivingEvents) {
      return 'verified';
    }
    return 'pending';
  }

  async recordWebhookVerificationSuccess(): Promise<void> {
    console.log('[WhatsApp] Webhook verification successful');
    await whatsappRepository.markAllActiveWebhooksVerified();
  }
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    const appSecret =
      config.whatsapp.appSecret ||
      process.env.META_APP_SECRET ||
      process.env.WHATSAPP_APP_SECRET ||
      '';
    if (!appSecret) {
      logger.warn('WhatsApp app secret not configured — skipping signature verification');
      return true;
    }
    if (!signature) return false;

    const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const received = signature.replace('sha256=', '');
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
    } catch {
      return false;
    }
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    const verifyToken = config.whatsapp.verifyToken;
    const normalizedMode = (mode ?? '').trim();
    const normalizedToken = (token ?? '').trim();
    const normalizedChallenge =
      challenge !== undefined && challenge !== null ? String(challenge).trim() : '';

    if (
      normalizedMode === 'subscribe' &&
      normalizedToken === verifyToken &&
      normalizedChallenge.length > 0
    ) {
      return normalizedChallenge;
    }
    return null;
  }

  async handleWebhook(body: Record<string, unknown>): Promise<void> {
    console.log('[WhatsApp] Incoming webhook received');
    await this.processWebhook(body);
  }

  async recordWebhookReceived(body: Record<string, unknown>): Promise<void> {
    if (!this.isWebhookInfrastructureReady()) {
      return;
    }

    const parsed = parseWebhookBody(body);
    this.logWebhookPayload(body, parsed);

    const phoneNumberId = parsed.phoneNumberId ?? config.whatsapp.phoneNumberId;
    const account = await whatsappRepository.resolveAccountForWebhook(phoneNumberId);

    if (!account) {
      logger.warn('Webhook received but no active WhatsApp account could be resolved');
      return;
    }

    try {
      await whatsappRepository.recordWebhookReceipt(account.phoneNumberId);
    } catch (error) {
      logger.warn('Failed to record webhook receipt timestamp', { error });
    }

    await whatsappRepository.markWebhookVerified(account.phoneNumberId);

    const syncData: {
      webhookStatus: string;
      webhookVerified: boolean;
      phoneNumberStatus?: string;
      phoneNumber?: string;
      lastWebhookReceivedAt: Date;
    } = {
      webhookStatus: 'verified',
      webhookVerified: true,
      lastWebhookReceivedAt: new Date(),
    };

    if (parsed.displayPhoneNumber) {
      syncData.phoneNumberStatus = 'active';
      syncData.phoneNumber = parsed.displayPhoneNumber;
      console.log('[WhatsApp] Phone active');
    }

    await whatsappRepository.syncAccountHealth(account.phoneNumberId, syncData);
  }

  async processWebhook(body: Record<string, unknown>) {
    const parsed = parseWebhookBody(body);
    const phoneNumberId = parsed.phoneNumberId ?? config.whatsapp.phoneNumberId;
    const account = await whatsappRepository.resolveAccountForWebhook(phoneNumberId);

    if (!account) {
      logger.warn(`No WhatsApp account found for phone_number_id: ${phoneNumberId ?? 'unknown'}`);
      return;
    }

    if (!parsed.messages.length && !parsed.statuses.length) {
      logger.info('Webhook received with no messages or statuses to process');
      await whatsappRepository.markWebhookVerified(account.phoneNumberId);
      return;
    }

    void ensureAiConfiguration(account.businessId).catch((error) => {
      logger.warn('Failed to ensure AI configuration', { error, businessId: account.businessId });
    });

    // Inbound messages first — customer is waiting for a WhatsApp reply.
    for (const msg of parsed.messages) {
      const recorded = await whatsappRepository.tryRecordWebhookEvent(
        msg.id,
        `message:${msg.type}`,
        account.businessId
      );
      if (!recorded) continue;

      const contactName = resolveContactName(parsed.contacts, msg.from);
      const extracted = extractMessageContent(msg);
      console.log('[WhatsApp] Message parsed:', extracted.type, extracted.content);

      startPipelineTrace(msg.id, {
        businessId: account.businessId,
        whatsappMsgId: msg.id,
      });

      await handleIncomingMessage({
        businessId: account.businessId,
        whatsappAccountId: account.id,
        phoneNumberId: account.phoneNumberId,
        accessToken: this.getAccountToken(account.accessToken),
        msg,
        contactName: contactName ?? undefined,
        pipelineKey: msg.id,
        extracted,
      });
    }

    void this.deferWebhookMaintenance(account, parsed);
  }

  private deferWebhookMaintenance(
    account: NonNullable<Awaited<ReturnType<typeof whatsappRepository.resolveAccountForWebhook>>>,
    parsed: ReturnType<typeof parseWebhookBody>
  ): void {
    void (async () => {
      try {
        await whatsappRepository.recordWebhookReceipt(account.phoneNumberId);
      } catch (error) {
        logger.warn('Failed to record webhook receipt timestamp', { error });
      }

      if (!account.webhookVerified) {
        await whatsappRepository.markWebhookVerified(account.phoneNumberId);
      }

      await whatsappRepository.updateAccountSync(account.phoneNumberId, {
        webhookStatus: 'verified',
      });

      for (const status of parsed.statuses) {
        const recorded = await whatsappRepository.tryRecordWebhookEvent(
          status.id,
          `status:${status.status}`,
          account.businessId
        );
        if (!recorded) continue;

        await whatsappRepository.updateMessageStatus(status.id, status.status, status.errors);
        console.log(`[WhatsApp] Delivery status ${status.status} for message ${status.id}`);
      }

      await whatsappRepository.markWebhookVerified(account.phoneNumberId);
      await whatsappRepository.syncAccountHealth(account.phoneNumberId, {
        webhookStatus: 'verified',
        webhookVerified: true,
        lastWebhookReceivedAt: new Date(),
      });
    })().catch((error) => logger.warn('Deferred webhook maintenance failed', { error }));
  }

  async getWebhookHealth(businessId: string): Promise<WhatsAppWebhookHealth> {
    const account = await whatsappRepository.findAccountByBusiness(businessId);
    const infrastructureReady = this.isWebhookInfrastructureReady();
    const lastWebhookReceivedAt = await whatsappRepository.getLastWebhookReceived(businessId);
    const hasStoredEvents = await whatsappRepository.hasWebhookActivity(businessId);
    const receivingEvents = Boolean(lastWebhookReceivedAt || hasStoredEvents);
    const subscriptionVerified = Boolean(account?.webhookVerified);
    const webhookVerified = subscriptionVerified || receivingEvents;

    const status = this.resolveWebhookStatus({
      webhookVerified,
      receivingEvents,
      infrastructureReady,
    });

    if (account?.isActive && webhookVerified) {
      await whatsappRepository.syncAccountHealth(account.phoneNumberId, {
        webhookStatus: 'verified',
        webhookVerified: true,
        ...(lastWebhookReceivedAt ? { lastWebhookReceivedAt } : {}),
      });
    }

    return {
      verified: webhookVerified,
      receivingEvents,
      lastWebhookReceived: lastWebhookReceivedAt?.toISOString() ?? null,
      status,
    };
  }

  async getSendStatus(businessId: string): Promise<WhatsAppSendStatus> {
    const pipelineState = getPipelineState(businessId);

    const [lastInbound, lastOutboundAttempt, lastOutboundSuccess] = await Promise.all([
      prisma.message.findFirst({
        where: { conversation: { businessId }, direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' },
        select: { content: true, createdAt: true },
      }),
      prisma.message.findFirst({
        where: { conversation: { businessId }, direction: 'OUTBOUND' },
        orderBy: { createdAt: 'desc' },
        select: { content: true, createdAt: true, status: true },
      }),
      prisma.message.findFirst({
        where: {
          conversation: { businessId },
          direction: 'OUTBOUND',
          status: { in: ['SENT', 'DELIVERED', 'READ'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { content: true, createdAt: true },
      }),
    ]);

    let pendingQueueJobs = 0;
    let failedJobs = 0;

    const aiQueue = getAiQueue();
    const whatsappQueue = getWhatsappQueue();
    for (const queue of [aiQueue, whatsappQueue]) {
      if (!queue) continue;
      try {
        const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
        pendingQueueJobs += (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
        failedJobs += counts.failed ?? 0;
      } catch (error) {
        logger.warn('Failed to read queue job counts', { error, queue: queue.name });
      }
    }

    return {
      lastInboundMessage:
        pipelineState.lastInboundMessage ??
        (lastInbound ? `${lastInbound.content} (${lastInbound.createdAt.toISOString()})` : null),
      lastOutboundAttempt:
        pipelineState.lastOutboundAttempt ??
        (lastOutboundAttempt
          ? `${lastOutboundAttempt.content} (${lastOutboundAttempt.createdAt.toISOString()}, ${lastOutboundAttempt.status})`
          : null),
      lastOutboundSuccess:
        pipelineState.lastOutboundSuccess ??
        (lastOutboundSuccess
          ? `${lastOutboundSuccess.content} (${lastOutboundSuccess.createdAt.toISOString()})`
          : null),
      pendingQueueJobs,
      failedJobs,
    };
  }

  async getDebug(businessId: string): Promise<WhatsAppDebugInfo> {
    const [webhookHealth, aiHealth, account, pipelineState] = await Promise.all([
      this.getWebhookHealth(businessId),
      getAiHealth(businessId),
      whatsappRepository.findAccountByBusiness(businessId),
      Promise.resolve(getPipelineState(businessId)),
    ]);

    const [
      totalMessages,
      totalCustomers,
      totalConversations,
      lastInbound,
      lastOutbound,
    ] = await Promise.all([
      prisma.message.count({ where: { conversation: { businessId } } }),
      prisma.customer.count({ where: { businessId } }),
      prisma.conversation.count({ where: { businessId } }),
      prisma.message.findFirst({
        where: { conversation: { businessId }, direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' },
        select: { content: true, createdAt: true },
      }),
      prisma.message.findFirst({
        where: { conversation: { businessId }, direction: 'OUTBOUND' },
        orderBy: { createdAt: 'desc' },
        select: { content: true, createdAt: true, status: true },
      }),
    ]);

    const token =
      account?.accessToken || config.whatsapp.accessToken ?
        await whatsappRepository.validateAccessToken(
          account?.phoneNumberId ?? config.whatsapp.phoneNumberId,
          this.getAccountToken(account?.accessToken)
        )
      : false;

    const graphResponse =
      pipelineState.lastGraphApiResponse ??
      (account?.lastGraphApiResponse ? JSON.stringify(account.lastGraphApiResponse) : null);
    const graphError =
      pipelineState.lastGraphApiError ??
      (account?.lastGraphApiError ? JSON.stringify(account.lastGraphApiError) : null);

    const webhookStatus = webhookHealth.verified ? 'verified' : webhookHealth.status;

    return {
      webhook: webhookStatus,
      token: !account && !config.whatsapp.accessToken ? 'not_configured' : token ? 'valid' : 'invalid',
      phone_status: (account?.phoneNumberStatus === 'active' ? 'active' : 'unknown') as WhatsAppDebugInfo['phone_status'],
      ai_status: aiHealth.status,
      last_incoming_message:
        pipelineState.lastInboundMessage ??
        (lastInbound ? `${lastInbound.content} (${lastInbound.createdAt.toISOString()})` : null),
      last_outgoing_message:
        pipelineState.lastOutboundSuccess ??
        (lastOutbound ? `${lastOutbound.content} (${lastOutbound.createdAt.toISOString()}, ${lastOutbound.status})` : null),
      last_graph_api_response: graphResponse,
      last_graph_api_error: graphError,
      lastWebhookReceived: webhookHealth.lastWebhookReceived,
      lastMessageProcessed: lastInbound?.createdAt.toISOString() ?? null,
      totalMessages,
      totalCustomers,
      totalConversations,
      webhookStatus,
    };
  }

  async getHealth(businessId: string): Promise<WhatsAppHealth> {
    const account = await whatsappRepository.findAccountByBusiness(businessId);
    const verifyTokenConfigured = Boolean(config.whatsapp.verifyToken);
    const webhookEndpointConfigured = Boolean(config.whatsapp.webhookUrl);
    const infrastructureReady = verifyTokenConfigured && webhookEndpointConfigured;
    const envConfigured = Boolean(
      config.whatsapp.accessToken && config.whatsapp.phoneNumberId
    );

    if (!account?.isActive) {
      return {
        connection: 'disconnected',
        webhook: infrastructureReady ? 'pending' : 'not_configured',
        phoneStatus: 'unknown',
        phoneNumber: null,
        phoneNumberId: null,
        wabaId: null,
        businessName: null,
        tokenStatus: envConfigured ? 'invalid' : 'not_configured',
        lastSync: null,
        lastWebhookReceived: null,
        lastIncomingMessage: null,
        lastOutgoingMessage: null,
        envConfigured,
      };
    }

    const token = this.getAccountToken(account.accessToken);
    let phoneNumber = account.phoneNumber;
    let phoneStatus: WhatsAppHealth['phoneStatus'] =
      account.phoneNumberStatus === 'active' ? 'active' : 'unknown';
    let wabaId = account.wabaId ?? config.whatsapp.businessAccountId ?? null;
    let businessName = account.displayName ?? null;
    let tokenStatus: WhatsAppHealth['tokenStatus'] = token ? 'invalid' : 'not_configured';

    if (token) {
      const tokenValid = await whatsappRepository.validateAccessToken(account.phoneNumberId, token);
      tokenStatus = tokenValid ? 'valid' : 'invalid';

      const info = await whatsappService.getPhoneNumberInfo(account.phoneNumberId, token);
      if (info?.displayPhoneNumber) {
        phoneNumber = info.displayPhoneNumber;
        phoneStatus = 'active';
        businessName = info.verifiedName ?? businessName;
        console.log('[WhatsApp] Phone active');
        await whatsappRepository.syncAccountHealth(account.phoneNumberId, {
          phoneNumber: info.displayPhoneNumber,
          phoneNumberStatus: 'active',
          displayName: info.verifiedName ?? account.displayName ?? undefined,
          wabaId: wabaId ?? undefined,
        });
      } else if (info) {
        businessName = info.verifiedName ?? businessName;
        await whatsappRepository.syncAccountHealth(account.phoneNumberId, {
          displayName: info.verifiedName ?? account.displayName ?? undefined,
        });
      }
    }

    const webhookHealth = await this.getWebhookHealth(businessId);
    const webhook = webhookHealth.verified ? 'verified' : webhookHealth.status;

    const [lastInbound, lastOutbound] = await Promise.all([
      prisma.message.findFirst({
        where: { conversation: { businessId }, direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' },
        select: { content: true, createdAt: true },
      }),
      prisma.message.findFirst({
        where: { conversation: { businessId }, direction: 'OUTBOUND' },
        orderBy: { createdAt: 'desc' },
        select: { content: true, createdAt: true },
      }),
    ]);

    const synced = await whatsappRepository.syncAccountHealth(account.phoneNumberId, {
      webhookStatus: webhook,
      webhookVerified: webhook === 'verified',
      phoneNumberStatus: phoneStatus,
      phoneNumber,
      wabaId: wabaId ?? undefined,
      ...(webhookHealth.lastWebhookReceived
        ? { lastWebhookReceivedAt: new Date(webhookHealth.lastWebhookReceived) }
        : {}),
    });

    console.log('[WhatsApp] Health check successful');

    return {
      connection: 'connected',
      webhook,
      phoneStatus,
      phoneNumber: synced.phoneNumber,
      phoneNumberId: synced.phoneNumberId,
      wabaId: synced.wabaId ?? wabaId,
      businessName,
      tokenStatus,
      lastSync: synced.lastSyncAt?.toISOString() ?? new Date().toISOString(),
      lastWebhookReceived: webhookHealth.lastWebhookReceived,
      lastIncomingMessage: lastInbound
        ? `${lastInbound.content} (${lastInbound.createdAt.toISOString()})`
        : null,
      lastOutgoingMessage: lastOutbound
        ? `${lastOutbound.content} (${lastOutbound.createdAt.toISOString()})`
        : null,
      envConfigured,
    };
  }

  getWebhookUrl(): string {
    return config.whatsapp.webhookUrl;
  }

  getLegacyWebhookUrl(): string {
    return `${config.apiUrl}/webhook`;
  }

  async listAccounts(businessId: string) {
    return prisma.whatsAppAccount.findMany({
      where: { businessId },
      select: {
        id: true,
        phoneNumberId: true,
        phoneNumber: true,
        displayName: true,
        wabaId: true,
        webhookVerified: true,
        phoneNumberStatus: true,
        webhookStatus: true,
        lastSyncAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConnectionStatus(businessId: string) {
    const [account, business] = await Promise.all([
      whatsappRepository.findAccountByBusiness(businessId),
      prisma.business.findUnique({
        where: { id: businessId },
        select: { whatsappStatus: true },
      }),
    ]);
    const envConfigured = Boolean(
      config.whatsapp.accessToken && config.whatsapp.phoneNumberId
    );
    const whatsappStatus =
      business?.whatsappStatus ?? (account?.isActive ? 'CONNECTED' : 'NOT_CONNECTED');

    return {
      connected: whatsappStatus === 'CONNECTED',
      whatsappStatus,
      account: account
        ? {
            id: account.id,
            phoneNumberId: account.phoneNumberId,
            phoneNumber: account.phoneNumber,
            displayName: account.displayName,
            wabaId: account.wabaId,
            webhookVerified: account.webhookVerified,
            phoneNumberStatus: account.phoneNumberStatus,
            webhookStatus: account.webhookStatus,
            lastSyncAt: account.lastSyncAt,
            isActive: account.isActive,
            createdAt: account.createdAt,
          }
        : null,
      envConfigured,
      webhookUrl: this.getWebhookUrl(),
      verifyTokenConfigured: Boolean(config.whatsapp.verifyToken),
      appSecretConfigured: Boolean(config.whatsapp.appSecret),
    };
  }

  async connectAccount(businessId: string, input: ConnectWhatsAppInput) {
    const existing = await prisma.whatsAppAccount.findUnique({
      where: { phoneNumberId: input.phoneNumberId },
    });

    if (existing && existing.businessId !== businessId) {
      throw new ConflictError('This phone number is already connected to another business');
    }

    const encryptedToken = encryptToken(input.accessToken);

    const account = await prisma.whatsAppAccount.upsert({
      where: { phoneNumberId: input.phoneNumberId },
      create: {
        businessId,
        phoneNumberId: input.phoneNumberId,
        phoneNumber: input.phoneNumber,
        displayName: input.displayName,
        wabaId: input.wabaId ?? config.whatsapp.businessAccountId,
        accessToken: encryptedToken,
        isActive: true,
        phoneNumberStatus: 'active',
        webhookStatus: 'pending',
      },
      update: {
        phoneNumber: input.phoneNumber,
        displayName: input.displayName,
        wabaId: input.wabaId ?? config.whatsapp.businessAccountId,
        accessToken: encryptedToken,
        isActive: true,
        phoneNumberStatus: 'active',
        lastSyncAt: new Date(),
      },
      select: {
        id: true,
        phoneNumberId: true,
        phoneNumber: true,
        displayName: true,
        webhookVerified: true,
        phoneNumberStatus: true,
        webhookStatus: true,
        lastSyncAt: true,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        businessId,
        action: 'CREATE',
        entity: 'WhatsAppAccount',
        entityId: account.id,
        newData: { phoneNumberId: input.phoneNumberId },
      },
    });

    await ensureAiConfiguration(businessId);
    await this.setBusinessWhatsAppStatus(businessId, 'CONNECTED');

    return account;
  }

  async connectFromEnv(businessId: string) {
    const phoneNumberId = config.whatsapp.phoneNumberId;
    const accessToken = config.whatsapp.accessToken;
    const wabaId = config.whatsapp.businessAccountId;

    if (!phoneNumberId || !accessToken) {
      throw new ValidationError(
        'WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN must be set in environment variables'
      );
    }

    const info = await whatsappService.getPhoneNumberInfo(phoneNumberId, accessToken);
    const displayPhone = info?.displayPhoneNumber ?? phoneNumberId;

    return this.connectAccount(businessId, {
      phoneNumberId,
      phoneNumber: displayPhone,
      displayName: info?.verifiedName,
      wabaId: wabaId || undefined,
      accessToken,
    });
  }

  async testConnection(businessId: string, accountId?: string) {
    const account = accountId
      ? await prisma.whatsAppAccount.findFirst({ where: { id: accountId, businessId } })
      : await whatsappRepository.findAccountByBusiness(businessId);

    if (!account) {
      throw new NotFoundError('No active WhatsApp account found');
    }

    const token = this.getAccountToken(account.accessToken);
    if (!token) {
      throw new ValidationError('WhatsApp access token is not configured');
    }

    const info = await whatsappService.getPhoneNumberInfo(account.phoneNumberId, token);
    if (!info) {
      throw new ValidationError('Failed to reach WhatsApp Cloud API — check credentials');
    }

    await whatsappRepository.updateAccountSync(account.phoneNumberId, {
      phoneNumberStatus: info.displayPhoneNumber ? 'active' : account.phoneNumberStatus ?? 'unknown',
      displayName: info.verifiedName ?? account.displayName ?? undefined,
      phoneNumber: info.displayPhoneNumber ?? account.phoneNumber,
    });

    if (info.displayPhoneNumber) {
      console.log('[WhatsApp] Phone active');
    }

    return {
      success: true,
      displayPhoneNumber: info.displayPhoneNumber,
      verifiedName: info.verifiedName,
      qualityRating: info.qualityRating,
      testedAt: new Date().toISOString(),
    };
  }

  async disconnectAccount(businessId: string, accountId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: accountId, businessId },
    });
    if (!account) {
      throw new NotFoundError('WhatsApp account not found');
    }

    await prisma.whatsAppAccount.update({
      where: { id: accountId },
      data: { isActive: false, phoneNumberStatus: 'disconnected' },
    });

    await this.setBusinessWhatsAppStatus(businessId, 'NOT_CONNECTED');

    await prisma.auditLog.create({
      data: {
        businessId,
        action: 'DELETE',
        entity: 'WhatsAppAccount',
        entityId: accountId,
      },
    });
  }
}

export const whatsappModuleService = new WhatsAppModuleService();
