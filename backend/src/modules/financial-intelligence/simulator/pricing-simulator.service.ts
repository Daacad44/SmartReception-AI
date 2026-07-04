import { financialConfigService } from '../financial-config.service';
import type { BreakEvenAnalysis, SimulatorPlanInput, SimulatorResult } from '../financial.types';

function estimatePlanMonthlyCost(plan: SimulatorPlanInput, rates: ReturnType<typeof financialConfigService.configToRates>) {
  const aiTokensMillions = plan.maxAiTokens / 1_000_000;
  const aiCost = aiTokensMillions * 0.2;
  const storageGb = plan.maxStorageMb / 1024;
  const storageCost = storageGb * rates.storagePerGbMonth;
  const whatsappCost =
    plan.maxWhatsappConversations * rates.whatsappService;
  const emailCost = plan.maxEmails * rates.emailPerSend;
  const infraPerBusiness =
    rates.infrastructureMonthly / Math.max(1, plan.expectedBusinessCount);
  const dbPerBusiness = rates.databaseMonthly / Math.max(1, plan.expectedBusinessCount);
  const redisPerBusiness = rates.redisMonthly / Math.max(1, plan.expectedBusinessCount);
  const monitoringPerBusiness = rates.monitoringMonthly / Math.max(1, plan.expectedBusinessCount);
  const backupPerBusiness = rates.backupMonthly / Math.max(1, plan.expectedBusinessCount);

  return {
    ai: aiCost,
    storage: storageCost,
    whatsapp: whatsappCost,
    email: emailCost,
    infrastructure: infraPerBusiness,
    database: dbPerBusiness,
    redis: redisPerBusiness,
    monitoring: monitoringPerBusiness,
    backup: backupPerBusiness,
    total:
      aiCost +
      storageCost +
      whatsappCost +
      emailCost +
      infraPerBusiness +
      dbPerBusiness +
      redisPerBusiness +
      monitoringPerBusiness +
      backupPerBusiness,
  };
}

export class PricingSimulatorService {
  async simulate(plan: SimulatorPlanInput): Promise<SimulatorResult> {
    const config = await financialConfigService.getConfig();
    const rates = financialConfigService.configToRates(config);
    const costBreakdown = estimatePlanMonthlyCost(plan, rates);
    const estimatedMonthlyRevenueUsd = plan.monthlyPriceUsd * plan.expectedBusinessCount;
    const estimatedYearlyRevenueUsd = plan.yearlyPriceUsd * plan.expectedBusinessCount;
    const estimatedMonthlyCostUsd = costBreakdown.total * plan.expectedBusinessCount;
    const estimatedProfitUsd = estimatedMonthlyRevenueUsd - estimatedMonthlyCostUsd;
    const profitMarginPercent =
      estimatedMonthlyRevenueUsd > 0
        ? (estimatedProfitUsd / estimatedMonthlyRevenueUsd) * 100
        : 0;

    const breakEvenBusinessCount =
      plan.monthlyPriceUsd > costBreakdown.total
        ? Math.ceil(
            (rates.infrastructureMonthly +
              rates.databaseMonthly +
              rates.redisMonthly +
              rates.monitoringMonthly +
              rates.backupMonthly) /
              Math.max(0.01, plan.monthlyPriceUsd - (costBreakdown.total - costBreakdown.infrastructure))
          )
        : Number.POSITIVE_INFINITY;

    const breakEvenRevenueUsd = breakEvenBusinessCount * plan.monthlyPriceUsd;
    const breakEvenMonth =
      Number.isFinite(breakEvenBusinessCount) && plan.monthlyPriceUsd > 0
        ? Math.ceil(breakEvenRevenueUsd / Math.max(1, estimatedMonthlyRevenueUsd))
        : null;

    return {
      planCode: plan.planCode,
      estimatedMonthlyRevenueUsd,
      estimatedYearlyRevenueUsd,
      estimatedMonthlyCostUsd,
      estimatedProfitUsd,
      profitMarginPercent,
      breakEvenBusinessCount: Number.isFinite(breakEvenBusinessCount) ? breakEvenBusinessCount : 0,
      breakEvenRevenueUsd: Number.isFinite(breakEvenRevenueUsd) ? breakEvenRevenueUsd : 0,
      breakEvenMonth,
      expectedRoiPercent:
        estimatedMonthlyCostUsd > 0 ? (estimatedProfitUsd / estimatedMonthlyCostUsd) * 100 : 0,
      costBreakdown,
    };
  }

  async simulateAll(plans: SimulatorPlanInput[]): Promise<SimulatorResult[]> {
    return Promise.all(plans.map((plan) => this.simulate(plan)));
  }

  async breakEvenAnalysis(plan: SimulatorPlanInput): Promise<BreakEvenAnalysis> {
    const config = await financialConfigService.getConfig();
    const rates = financialConfigService.configToRates(config);
    const costs = estimatePlanMonthlyCost(plan, rates);
    const result = await this.simulate(plan);

    return {
      minimumBusinessesNeeded: result.breakEvenBusinessCount,
      minimumRevenueNeededUsd: result.breakEvenRevenueUsd,
      infrastructureRecoveryUsd: rates.infrastructureMonthly,
      aiRecoveryUsd: costs.ai * plan.expectedBusinessCount,
      storageRecoveryUsd: costs.storage * plan.expectedBusinessCount,
      breakEvenMonth: result.breakEvenMonth,
      breakEvenRevenueUsd: result.breakEvenRevenueUsd,
    };
  }
}

export class ForecastService {
  async forecastScales(base: {
    avgRevenuePerBusiness: number;
    avgCostPerBusiness: number;
    avgAiCostPerBusiness: number;
    avgStorageGbPerBusiness: number;
  }) {
    const scales = [100, 500, 1000, 5000, 10000];
    return scales.map((businessCount) => {
      const projectedRevenueUsd = base.avgRevenuePerBusiness * businessCount;
      const projectedOperatingCostUsd = base.avgCostPerBusiness * businessCount;
      const projectedProfitUsd = projectedRevenueUsd - projectedOperatingCostUsd;
      return {
        businessCount,
        projectedRevenueUsd,
        projectedOperatingCostUsd,
        projectedProfitUsd,
        projectedAiSpendingUsd: base.avgAiCostPerBusiness * businessCount,
        projectedStorageGb: base.avgStorageGbPerBusiness * businessCount,
        infrastructureRequirement:
          businessCount <= 500
            ? 'Single VPS cluster'
            : businessCount <= 5000
              ? 'Multi-node VPS + read replicas'
              : 'Kubernetes cluster + dedicated DB',
      };
    });
  }
}

export const pricingSimulatorService = new PricingSimulatorService();
export const forecastService = new ForecastService();
