import { prisma } from '../../../infrastructure/database/prisma';
import { financialConfigService } from '../financial-config.service';
import type { BusinessProfitBreakdown, BusinessRevenueBreakdown } from '../financial.types';
import type { BusinessCostBreakdown } from '../financial.types';
import type { FinancialAlertType, FinancialAlertSeverity } from '@prisma/client';

export class FinancialAlertService {
  async evaluateBusinessAlerts(params: {
    businessId: string;
    revenue: BusinessRevenueBreakdown;
    costs: BusinessCostBreakdown;
    profit: BusinessProfitBreakdown;
    usage?: {
      aiTokensMonthly?: number;
      aiTokenLimit?: number;
      storageMb?: number;
      storageLimitMb?: number;
      whatsappConversations?: number;
      whatsappLimit?: number;
    };
  }): Promise<void> {
    const config = await financialConfigService.getConfig();
    const threshold = Number(config.profitMarginAlertThresholdPercent);
    const alerts: Array<{
      type: FinancialAlertType;
      severity: FinancialAlertSeverity;
      title: string;
      message: string;
      metadata?: Record<string, unknown>;
    }> = [];

    if (params.costs.totalOperatingCostUsd > params.revenue.monthlyRevenueUsd) {
      alerts.push({
        type: 'COST_EXCEEDS_REVENUE',
        severity: 'CRITICAL',
        title: 'Operating cost exceeds subscription revenue',
        message: `Monthly operating cost $${params.costs.totalOperatingCostUsd.toFixed(2)} exceeds revenue $${params.revenue.monthlyRevenueUsd.toFixed(2)}.`,
        metadata: {
          operatingCostUsd: params.costs.totalOperatingCostUsd,
          revenueUsd: params.revenue.monthlyRevenueUsd,
        },
      });
    }

    if (params.profit.isOperatingAtLoss) {
      alerts.push({
        type: 'BUSINESS_UNPROFITABLE',
        severity: 'CRITICAL',
        title: 'Business operating at a loss',
        message: `Net profit is $${params.profit.netProfitUsd.toFixed(2)} for the current period.`,
      });
    }

    if (
      params.profit.profitMarginPercent < threshold &&
      params.revenue.monthlyRevenueUsd > 0
    ) {
      alerts.push({
        type: 'PROFIT_MARGIN_LOW',
        severity: 'WARNING',
        title: 'Profit margin below threshold',
        message: `Profit margin ${params.profit.profitMarginPercent.toFixed(1)}% is below configured threshold ${threshold}%.`,
      });
    }

    const usage = params.usage;
    if (usage?.aiTokenLimit && (usage.aiTokensMonthly ?? 0) > usage.aiTokenLimit) {
      alerts.push({
        type: 'AI_LIMIT_EXCEEDED',
        severity: 'WARNING',
        title: 'AI token usage exceeds plan limit',
        message: `Used ${usage.aiTokensMonthly} tokens against plan limit ${usage.aiTokenLimit}.`,
      });
    }
    if (usage?.storageLimitMb && (usage.storageMb ?? 0) > usage.storageLimitMb) {
      alerts.push({
        type: 'STORAGE_LIMIT_EXCEEDED',
        severity: 'WARNING',
        title: 'Storage usage exceeds plan limit',
        message: `Used ${usage.storageMb} MB against plan limit ${usage.storageLimitMb} MB.`,
      });
    }
    if (
      usage?.whatsappLimit &&
      (usage.whatsappConversations ?? 0) > usage.whatsappLimit
    ) {
      alerts.push({
        type: 'WHATSAPP_LIMIT_EXCEEDED',
        severity: 'WARNING',
        title: 'WhatsApp usage exceeds plan limit',
        message: `Used ${usage.whatsappConversations} conversations against plan limit ${usage.whatsappLimit}.`,
      });
    }

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const alert of alerts) {
      const existing = await prisma.financialAlert.findFirst({
        where: {
          businessId: params.businessId,
          type: alert.type,
          acknowledgedAt: null,
          createdAt: { gte: dayAgo },
        },
      });
      if (existing) continue;

      await prisma.financialAlert.create({
        data: {
          businessId: params.businessId,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          metadata: alert.metadata as object | undefined,
        },
      });
    }
  }

  async listAlerts(params: { businessId?: string; limit?: number }) {
    return prisma.financialAlert.findMany({
      where: {
        ...(params.businessId ? { businessId: params.businessId } : {}),
        acknowledgedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 50,
      include: {
        business: { select: { id: true, name: true } },
      },
    });
  }

  async acknowledgeAlert(alertId: string, userId: string) {
    return prisma.financialAlert.update({
      where: { id: alertId },
      data: { acknowledgedAt: new Date(), acknowledgedById: userId },
    });
  }
}

export const financialAlertService = new FinancialAlertService();
