import { prisma } from '../../infrastructure/database/prisma';
import type { PlatformFinancialConfig } from '@prisma/client';
import type { FinancialAuditInput } from './financial.types';

const DEFAULT_CONFIG = {
  id: 'default',
  currency: 'USD',
  infrastructureMonthlyCostUsd: 120,
  databaseMonthlyCostUsd: 25,
  redisMonthlyCostUsd: 15,
  monitoringMonthlyCostUsd: 10,
  backupMonthlyCostUsd: 8,
  whatsappAuthCostPerConversation: 0.005,
  whatsappMarketingCostPerConversation: 0.04,
  whatsappUtilityCostPerConversation: 0.02,
  whatsappServiceCostPerConversation: 0.01,
  emailCostPerSend: 0.001,
  storageCostPerGbMonth: 0.023,
  profitMarginAlertThresholdPercent: 20,
  useWeightedInfrastructureAllocation: false,
} as const;

function toNumber(value: unknown): number {
  if (value == null) return 0;
  return Number(value);
}

export class FinancialConfigService {
  async getConfig(): Promise<PlatformFinancialConfig> {
    const existing = await prisma.platformFinancialConfig.findUnique({
      where: { id: 'default' },
    });
    if (existing) return existing;

    return prisma.platformFinancialConfig.create({
      data: { ...DEFAULT_CONFIG },
    });
  }

  async updateConfig(
    input: Partial<Omit<PlatformFinancialConfig, 'id' | 'createdAt' | 'updatedAt'>>,
    actor?: { userId?: string; email?: string; ipAddress?: string }
  ): Promise<PlatformFinancialConfig> {
    const previous = await this.getConfig();
    const updated = await prisma.platformFinancialConfig.update({
      where: { id: 'default' },
      data: {
        ...input,
        updatedById: actor?.userId,
      },
    });

    await financialAuditService.log({
      action: 'UPDATE_FINANCIAL_CONFIG',
      entity: 'PlatformFinancialConfig',
      previousValue: previous,
      newValue: updated,
      operatorId: actor?.userId,
      operatorEmail: actor?.email,
      ipAddress: actor?.ipAddress,
      reason: 'Platform financial configuration updated',
      verificationStatus: 'VERIFIED',
    });

    return updated;
  }

  configToRates(config: PlatformFinancialConfig) {
    return {
      infrastructureMonthly: toNumber(config.infrastructureMonthlyCostUsd),
      databaseMonthly: toNumber(config.databaseMonthlyCostUsd),
      redisMonthly: toNumber(config.redisMonthlyCostUsd),
      monitoringMonthly: toNumber(config.monitoringMonthlyCostUsd),
      backupMonthly: toNumber(config.backupMonthlyCostUsd),
      whatsappAuth: toNumber(config.whatsappAuthCostPerConversation),
      whatsappMarketing: toNumber(config.whatsappMarketingCostPerConversation),
      whatsappUtility: toNumber(config.whatsappUtilityCostPerConversation),
      whatsappService: toNumber(config.whatsappServiceCostPerConversation),
      emailPerSend: toNumber(config.emailCostPerSend),
      storagePerGbMonth: toNumber(config.storageCostPerGbMonth),
      profitMarginAlertThreshold: toNumber(config.profitMarginAlertThresholdPercent),
      useWeightedInfrastructureAllocation: config.useWeightedInfrastructureAllocation,
    };
  }
}

export class FinancialAuditService {
  async log(input: FinancialAuditInput): Promise<void> {
    await prisma.financialAuditLog.create({
      data: {
        businessId: input.businessId,
        action: input.action,
        entity: input.entity,
        previousValue: input.previousValue as object | undefined,
        newValue: input.newValue as object | undefined,
        operatorId: input.operatorId,
        operatorEmail: input.operatorEmail,
        ipAddress: input.ipAddress,
        reason: input.reason,
        verificationStatus: input.verificationStatus,
      },
    });
  }

  async list(params: { businessId?: string; limit?: number }) {
    return prisma.financialAuditLog.findMany({
      where: params.businessId ? { businessId: params.businessId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 100,
      include: {
        operator: { select: { id: true, email: true, firstName: true, lastName: true } },
        business: { select: { id: true, name: true } },
      },
    });
  }
}

export const financialConfigService = new FinancialConfigService();
export const financialAuditService = new FinancialAuditService();
