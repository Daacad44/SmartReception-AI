CREATE TABLE IF NOT EXISTS "ai_business_snapshots" (
  "businessId" TEXT NOT NULL,
  "totalCustomers" INTEGER NOT NULL DEFAULT 0,
  "activeCustomers" INTEGER NOT NULL DEFAULT 0,
  "returningCustomers" INTEGER NOT NULL DEFAULT 0,
  "totalConversations" INTEGER NOT NULL DEFAULT 0,
  "totalCustomerMessages" INTEGER NOT NULL DEFAULT 0,
  "totalAiMessages" INTEGER NOT NULL DEFAULT 0,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "totalTokens" INTEGER NOT NULL DEFAULT 0,
  "dailyTokens" INTEGER NOT NULL DEFAULT 0,
  "weeklyTokens" INTEGER NOT NULL DEFAULT 0,
  "monthlyTokens" INTEGER NOT NULL DEFAULT 0,
  "lifetimeTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedAiCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "monthlyAiCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "lifetimeAiCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "avgTokensPerConversation" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avgTokensPerCustomer" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avgResponseTimeMs" INTEGER NOT NULL DEFAULT 0,
  "topProvider" TEXT,
  "knowledgeBaseSize" INTEGER NOT NULL DEFAULT 0,
  "trainingStatus" TEXT,
  "lastTrainingAt" TIMESTAMP(3),
  "healthScore" DOUBLE PRECISION,
  "automationSuccessRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tokenSavingsPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tokenSavingsTokens" INTEGER NOT NULL DEFAULT 0,
  "lastActivityAt" TIMESTAMP(3),
  "backfilledAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_business_snapshots_pkey" PRIMARY KEY ("businessId")
);

ALTER TABLE "ai_business_snapshots"
  ADD CONSTRAINT "ai_business_snapshots_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
