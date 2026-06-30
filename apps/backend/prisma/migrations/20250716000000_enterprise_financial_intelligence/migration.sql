-- Enterprise Financial Intelligence Platform

CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY', 'CUSTOM');
CREATE TYPE "FinancialAlertType" AS ENUM (
  'COST_EXCEEDS_REVENUE',
  'AI_LIMIT_EXCEEDED',
  'STORAGE_LIMIT_EXCEEDED',
  'WHATSAPP_LIMIT_EXCEEDED',
  'PROFIT_MARGIN_LOW',
  'INFRASTRUCTURE_COST_SPIKE',
  'BUSINESS_UNPROFITABLE'
);
CREATE TYPE "FinancialAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "FinancialCostProviderKey" AS ENUM (
  'AI',
  'WHATSAPP',
  'EMAIL',
  'STORAGE',
  'INFRASTRUCTURE',
  'DATABASE',
  'REDIS',
  'MONITORING',
  'BACKUP'
);

ALTER TABLE "business_subscriptions"
  ADD COLUMN IF NOT EXISTS "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paymentGateway" TEXT,
  ADD COLUMN IF NOT EXISTS "taxRatePercent" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "discountPercent" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "lifetimeRevenueUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mrrContributionUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "arrContributionUsd" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "platform_financial_config" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "infrastructureMonthlyCostUsd" DECIMAL(12,2) NOT NULL DEFAULT 120,
  "databaseMonthlyCostUsd" DECIMAL(12,2) NOT NULL DEFAULT 25,
  "redisMonthlyCostUsd" DECIMAL(12,2) NOT NULL DEFAULT 15,
  "monitoringMonthlyCostUsd" DECIMAL(12,2) NOT NULL DEFAULT 10,
  "backupMonthlyCostUsd" DECIMAL(12,2) NOT NULL DEFAULT 8,
  "whatsappAuthCostPerConversation" DECIMAL(10,6) NOT NULL DEFAULT 0.005,
  "whatsappMarketingCostPerConversation" DECIMAL(10,6) NOT NULL DEFAULT 0.04,
  "whatsappUtilityCostPerConversation" DECIMAL(10,6) NOT NULL DEFAULT 0.02,
  "whatsappServiceCostPerConversation" DECIMAL(10,6) NOT NULL DEFAULT 0.01,
  "emailCostPerSend" DECIMAL(10,6) NOT NULL DEFAULT 0.001,
  "storageCostPerGbMonth" DECIMAL(10,6) NOT NULL DEFAULT 0.023,
  "profitMarginAlertThresholdPercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
  "useWeightedInfrastructureAllocation" BOOLEAN NOT NULL DEFAULT false,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_financial_config_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_financial_config" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "business_financial_profiles" (
  "businessId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "planCode" TEXT,
  "planName" TEXT,
  "billingCycle" "BillingCycle",
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "monthlyRevenueUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "yearlyRevenueUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "lifetimeRevenueUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "mrrContributionUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "arrContributionUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "failedPaymentsUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "refundsUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "outstandingInvoicesUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "aiCostUsd" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "whatsappCostUsd" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "emailCostUsd" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "storageCostUsd" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "infrastructureCostUsd" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "databaseCostUsd" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "redisCostUsd" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "monitoringCostUsd" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "backupCostUsd" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "totalOperatingCostUsd" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "grossProfitUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "netProfitUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "profitMarginPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "operatingMarginPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "costRecoveryPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "roiPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "customerLifetimeValueUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "avgProfitPerCustomerUsd" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "avgProfitPerConversationUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
  "avgProfitPerTokenUsd" DECIMAL(12,8) NOT NULL DEFAULT 0,
  "isProfitable" BOOLEAN NOT NULL DEFAULT false,
  "isOperatingAtLoss" BOOLEAN NOT NULL DEFAULT false,
  "revenueBreakdown" JSONB,
  "costBreakdown" JSONB,
  "usageBreakdown" JSONB,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_financial_profiles_pkey" PRIMARY KEY ("businessId")
);

CREATE TABLE IF NOT EXISTS "platform_financial_snapshots" (
  "id" TEXT NOT NULL,
  "snapshotDate" DATE NOT NULL,
  "totalMrrUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalArrUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "monthlyRevenueUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "yearlyRevenueUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "lifetimeRevenueUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalOperatingCostUsd" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "aiCostUsd" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "whatsappCostUsd" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "emailCostUsd" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "storageCostUsd" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "infrastructureCostUsd" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "databaseCostUsd" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "redisCostUsd" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "monitoringCostUsd" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "backupCostUsd" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "grossProfitUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "netProfitUsd" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "platformProfitMarginPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "activeBusinessCount" INTEGER NOT NULL DEFAULT 0,
  "profitableBusinessCount" INTEGER NOT NULL DEFAULT 0,
  "lossBusinessCount" INTEGER NOT NULL DEFAULT 0,
  "breakdown" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_financial_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "financial_audit_logs" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "previousValue" JSONB,
  "newValue" JSONB,
  "operatorId" TEXT,
  "operatorEmail" TEXT,
  "ipAddress" TEXT,
  "reason" TEXT,
  "verificationStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "financial_alerts" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "type" "FinancialAlertType" NOT NULL,
  "severity" "FinancialAlertSeverity" NOT NULL DEFAULT 'WARNING',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_alerts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "financial_cost_events" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "provider" "FinancialCostProviderKey" NOT NULL,
  "amountUsd" DECIMAL(12,6) NOT NULL,
  "quantity" DECIMAL(14,4),
  "unit" TEXT,
  "referenceId" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_cost_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_financial_snapshots_snapshotDate_key"
  ON "platform_financial_snapshots"("snapshotDate");
CREATE INDEX IF NOT EXISTS "business_financial_profiles_planCode_idx"
  ON "business_financial_profiles"("planCode");
CREATE INDEX IF NOT EXISTS "business_financial_profiles_isProfitable_idx"
  ON "business_financial_profiles"("isProfitable");
CREATE INDEX IF NOT EXISTS "business_financial_profiles_isOperatingAtLoss_idx"
  ON "business_financial_profiles"("isOperatingAtLoss");
CREATE INDEX IF NOT EXISTS "business_financial_profiles_calculatedAt_idx"
  ON "business_financial_profiles"("calculatedAt");
CREATE INDEX IF NOT EXISTS "financial_audit_logs_businessId_idx" ON "financial_audit_logs"("businessId");
CREATE INDEX IF NOT EXISTS "financial_audit_logs_action_idx" ON "financial_audit_logs"("action");
CREATE INDEX IF NOT EXISTS "financial_audit_logs_createdAt_idx" ON "financial_audit_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "financial_alerts_businessId_idx" ON "financial_alerts"("businessId");
CREATE INDEX IF NOT EXISTS "financial_alerts_type_idx" ON "financial_alerts"("type");
CREATE INDEX IF NOT EXISTS "financial_alerts_severity_idx" ON "financial_alerts"("severity");
CREATE INDEX IF NOT EXISTS "financial_alerts_createdAt_idx" ON "financial_alerts"("createdAt");
CREATE INDEX IF NOT EXISTS "financial_cost_events_businessId_provider_idx"
  ON "financial_cost_events"("businessId", "provider");
CREATE INDEX IF NOT EXISTS "financial_cost_events_businessId_occurredAt_idx"
  ON "financial_cost_events"("businessId", "occurredAt");
CREATE INDEX IF NOT EXISTS "financial_cost_events_provider_occurredAt_idx"
  ON "financial_cost_events"("provider", "occurredAt");

ALTER TABLE "business_financial_profiles"
  ADD CONSTRAINT "business_financial_profiles_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_audit_logs"
  ADD CONSTRAINT "financial_audit_logs_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_audit_logs"
  ADD CONSTRAINT "financial_audit_logs_operatorId_fkey"
  FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "financial_alerts"
  ADD CONSTRAINT "financial_alerts_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_cost_events"
  ADD CONSTRAINT "financial_cost_events_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
