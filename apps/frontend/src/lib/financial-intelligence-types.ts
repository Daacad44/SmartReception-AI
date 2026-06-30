export interface BusinessFinancialCard {
  businessId: string;
  planCode: string | null;
  planName: string | null;
  monthlyRevenueUsd: number;
  yearlyRevenueUsd: number;
  lifetimeRevenueUsd: number;
  totalOperatingCostUsd: number;
  aiCostUsd: number;
  whatsappCostUsd: number;
  emailCostUsd: number;
  storageCostUsd: number;
  grossProfitUsd: number;
  netProfitUsd: number;
  profitMarginPercent: number;
  isProfitable: boolean;
  isOperatingAtLoss: boolean;
  calculatedAt: string;
  business?: {
    id: string;
    name: string;
    industry: string | null;
    logoUrl: string | null;
    isActive: boolean;
  };
}

export interface PlatformFinancialDashboard {
  totalMrrUsd: number;
  totalArrUsd: number;
  monthlyRevenueUsd: number;
  yearlyRevenueUsd: number;
  lifetimeRevenueUsd: number;
  totalOperatingCostUsd: number;
  aiCostUsd: number;
  whatsappCostUsd: number;
  emailCostUsd: number;
  storageCostUsd: number;
  infrastructureCostUsd: number;
  databaseCostUsd: number;
  redisCostUsd: number;
  monitoringCostUsd: number;
  backupCostUsd: number;
  grossProfitUsd: number;
  netProfitUsd: number;
  platformProfitMarginPercent: number;
  avgProfitPerBusinessUsd: number;
  activeBusinessCount: number;
  profitableBusinessCount: number;
  lossBusinessCount: number;
  mostProfitableBusiness: { businessId: string; name: string; profitUsd: number } | null;
  leastProfitableBusiness: { businessId: string; name: string; profitUsd: number } | null;
  businessesAtLoss: Array<{ businessId: string; name: string; profitUsd: number }>;
  topRevenueBusinesses: Array<{ businessId: string; name: string; revenueUsd: number }>;
  topAiCostBusinesses: Array<{ businessId: string; name: string; costUsd: number }>;
  topStorageBusinesses: Array<{ businessId: string; name: string; costUsd: number }>;
  topWhatsappBusinesses: Array<{ businessId: string; name: string; costUsd: number }>;
  topEmailBusinesses: Array<{ businessId: string; name: string; costUsd: number }>;
  trends: Record<string, Array<{ date: string; value: number }>>;
  calculatedAt: string;
}

export interface SimulatorResult {
  planCode: string;
  estimatedMonthlyRevenueUsd: number;
  estimatedYearlyRevenueUsd: number;
  estimatedMonthlyCostUsd: number;
  estimatedProfitUsd: number;
  profitMarginPercent: number;
  breakEvenBusinessCount: number;
  breakEvenRevenueUsd: number;
  breakEvenMonth: number | null;
  expectedRoiPercent: number;
  costBreakdown: Record<string, number>;
}

export interface ForecastScale {
  businessCount: number;
  projectedRevenueUsd: number;
  projectedOperatingCostUsd: number;
  projectedProfitUsd: number;
  projectedAiSpendingUsd: number;
  projectedStorageGb: number;
  infrastructureRequirement: string;
}
