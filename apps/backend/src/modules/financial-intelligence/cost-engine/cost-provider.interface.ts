import type { FinancialPeriod } from '../financial.types';

export interface CostProviderContext {
  businessId: string;
  period: FinancialPeriod;
  since?: Date;
  rates: {
    infrastructureMonthly: number;
    databaseMonthly: number;
    redisMonthly: number;
    monitoringMonthly: number;
    backupMonthly: number;
    whatsappAuth: number;
    whatsappMarketing: number;
    whatsappUtility: number;
    whatsappService: number;
    emailPerSend: number;
    storagePerGbMonth: number;
    useWeightedInfrastructureAllocation: boolean;
  };
  activeBusinessCount: number;
  allocationWeight?: number;
}

export interface CostProvider {
  readonly key: string;
  calculate(ctx: CostProviderContext): Promise<import('../financial.types').CostProviderResult>;
}

export function periodMultiplier(period: FinancialPeriod): {
  daily: number;
  weekly: number;
  monthly: number;
  lifetime: number;
} {
  switch (period) {
    case 'daily':
      return { daily: 1, weekly: 1 / 7, monthly: 1 / 30, lifetime: 1 / 30 };
    case 'weekly':
      return { daily: 7, weekly: 1, monthly: 1 / 4, lifetime: 1 / 4 };
    case 'monthly':
      return { daily: 30, weekly: 4, monthly: 1, lifetime: 1 };
    case 'yearly':
      return { daily: 365, weekly: 52, monthly: 12, lifetime: 12 };
    case 'lifetime':
    default:
      return { daily: 30, weekly: 4, monthly: 1, lifetime: 1 };
  }
}

export function allocatePlatformCost(
  monthlyTotal: number,
  activeBusinessCount: number,
  weight = 1,
  totalWeight = 1
): number {
  if (activeBusinessCount <= 0) return 0;
  if (totalWeight > 0 && totalWeight !== activeBusinessCount) {
    return (monthlyTotal * weight) / totalWeight;
  }
  return monthlyTotal / activeBusinessCount;
}

export function buildCostResult(
  provider: string,
  monthlyCostUsd: number,
  breakdown: Record<string, unknown>
): import('../financial.types').CostProviderResult {
  return {
    provider,
    dailyCostUsd: monthlyCostUsd / 30,
    weeklyCostUsd: monthlyCostUsd / 4,
    monthlyCostUsd,
    lifetimeCostUsd: monthlyCostUsd,
    breakdown,
  };
}
