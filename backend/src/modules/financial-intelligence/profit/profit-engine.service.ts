import type { BusinessCostBreakdown, BusinessProfitBreakdown, BusinessRevenueBreakdown } from '../financial.types';

export class ProfitEngineService {
  calculateBusinessProfit(
    revenue: BusinessRevenueBreakdown,
    costs: BusinessCostBreakdown,
    usage?: { customers: number; conversations: number; totalTokens: number }
  ): BusinessProfitBreakdown {
    const revenueUsd = revenue.monthlyRevenueUsd;
    const operatingCostUsd = costs.totalOperatingCostUsd;
    const grossProfitUsd = revenueUsd - operatingCostUsd;
    const netProfitUsd = grossProfitUsd - revenue.refundsUsd;
    const profitMarginPercent =
      revenueUsd > 0 ? (netProfitUsd / revenueUsd) * 100 : netProfitUsd < 0 ? -100 : 0;
    const operatingMarginPercent =
      revenueUsd > 0 ? (grossProfitUsd / revenueUsd) * 100 : grossProfitUsd < 0 ? -100 : 0;
    const costRecoveryPercent =
      operatingCostUsd > 0 ? (revenueUsd / operatingCostUsd) * 100 : revenueUsd > 0 ? 100 : 0;
    const roiPercent =
      operatingCostUsd > 0 ? (netProfitUsd / operatingCostUsd) * 100 : netProfitUsd > 0 ? 100 : 0;
    const contributionMarginPercent = operatingMarginPercent;

    const customers = usage?.customers ?? 0;
    const conversations = usage?.conversations ?? 0;
    const totalTokens = usage?.totalTokens ?? 0;

    return {
      revenueUsd,
      operatingCostUsd,
      grossProfitUsd,
      netProfitUsd,
      profitMarginPercent,
      operatingMarginPercent,
      costRecoveryPercent,
      roiPercent,
      contributionMarginPercent,
      customerLifetimeValueUsd:
        customers > 0 ? revenue.lifetimeRevenueUsd / customers : revenue.lifetimeRevenueUsd,
      avgProfitPerCustomerUsd: customers > 0 ? netProfitUsd / customers : 0,
      avgProfitPerConversationUsd: conversations > 0 ? netProfitUsd / conversations : 0,
      avgProfitPerTokenUsd: totalTokens > 0 ? netProfitUsd / totalTokens : 0,
      isProfitable: netProfitUsd > 0,
      isOperatingAtLoss: netProfitUsd < 0 || operatingCostUsd > revenueUsd,
    };
  }
}

export const profitEngineService = new ProfitEngineService();
