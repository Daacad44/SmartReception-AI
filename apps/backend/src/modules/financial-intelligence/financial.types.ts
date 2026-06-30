export type FinancialPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime';

export interface CostProviderResult {
  provider: string;
  dailyCostUsd: number;
  weeklyCostUsd: number;
  monthlyCostUsd: number;
  lifetimeCostUsd: number;
  breakdown: Record<string, unknown>;
}

export interface BusinessCostBreakdown {
  ai: CostProviderResult;
  whatsapp: CostProviderResult;
  email: CostProviderResult;
  storage: CostProviderResult;
  infrastructure: CostProviderResult;
  database: CostProviderResult;
  redis: CostProviderResult;
  monitoring: CostProviderResult;
  backup: CostProviderResult;
  totalOperatingCostUsd: number;
}

export interface BusinessRevenueBreakdown {
  monthlyRevenueUsd: number;
  yearlyRevenueUsd: number;
  lifetimeRevenueUsd: number;
  mrrContributionUsd: number;
  arrContributionUsd: number;
  failedPaymentsUsd: number;
  refundsUsd: number;
  outstandingInvoicesUsd: number;
  recurringRevenueUsd: number;
  revenuePerCustomerUsd: number;
  revenueGrowthPercent: number;
  revenueDeclinePercent: number;
  byPlan: Array<{ planCode: string; planName: string; revenueUsd: number }>;
  byCountry: Array<{ country: string; revenueUsd: number }>;
  byMonth: Array<{ month: string; revenueUsd: number }>;
}

export interface BusinessProfitBreakdown {
  revenueUsd: number;
  operatingCostUsd: number;
  grossProfitUsd: number;
  netProfitUsd: number;
  profitMarginPercent: number;
  operatingMarginPercent: number;
  costRecoveryPercent: number;
  roiPercent: number;
  contributionMarginPercent: number;
  customerLifetimeValueUsd: number;
  avgProfitPerCustomerUsd: number;
  avgProfitPerConversationUsd: number;
  avgProfitPerTokenUsd: number;
  isProfitable: boolean;
  isOperatingAtLoss: boolean;
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
  trends: {
    revenue: Array<{ date: string; value: number }>;
    cost: Array<{ date: string; value: number }>;
    profit: Array<{ date: string; value: number }>;
    mrr: Array<{ date: string; value: number }>;
    arr: Array<{ date: string; value: number }>;
    aiCost: Array<{ date: string; value: number }>;
    storage: Array<{ date: string; value: number }>;
    whatsapp: Array<{ date: string; value: number }>;
    email: Array<{ date: string; value: number }>;
    infrastructure: Array<{ date: string; value: number }>;
  };
  calculatedAt: string;
}

export interface SimulatorPlanInput {
  planCode: string;
  planName: string;
  monthlyPriceUsd: number;
  yearlyPriceUsd: number;
  maxAiTokens: number;
  maxStorageMb: number;
  maxWhatsappConversations: number;
  maxEmails: number;
  maxTeamMembers: number;
  maxCustomers: number;
  maxAiRequests: number;
  maxKnowledgeBaseSize: number;
  maxAiTrainingSessions: number;
  expectedBusinessCount: number;
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

export interface BreakEvenAnalysis {
  minimumBusinessesNeeded: number;
  minimumRevenueNeededUsd: number;
  infrastructureRecoveryUsd: number;
  aiRecoveryUsd: number;
  storageRecoveryUsd: number;
  breakEvenMonth: number | null;
  breakEvenRevenueUsd: number;
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

export interface FinancialAuditInput {
  businessId?: string;
  action: string;
  entity: string;
  previousValue?: unknown;
  newValue?: unknown;
  operatorId?: string;
  operatorEmail?: string;
  ipAddress?: string;
  reason?: string;
  verificationStatus?: string;
}
