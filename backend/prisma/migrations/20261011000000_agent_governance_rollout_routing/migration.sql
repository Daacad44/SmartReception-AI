-- Phase 11: tenant governance policies
CREATE TABLE "ai_agent_governance_policies" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "minimumConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
  "maximumHallucinationRisk" DOUBLE PRECISION NOT NULL DEFAULT 0.55,
  "requireHumanReleaseApproval" BOOLEAN NOT NULL DEFAULT true,
  "requireSeparateApprover" BOOLEAN NOT NULL DEFAULT true,
  "highRiskActionConfirmation" BOOLEAN NOT NULL DEFAULT true,
  "executionRetentionDays" INTEGER NOT NULL DEFAULT 90,
  "evidenceRetentionDays" INTEGER NOT NULL DEFAULT 365,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_agent_governance_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_agent_governance_thresholds_check" CHECK ("minimumConfidence" BETWEEN 0 AND 1 AND "maximumHallucinationRisk" BETWEEN 0 AND 1),
  CONSTRAINT "ai_agent_governance_retention_check" CHECK ("executionRetentionDays" BETWEEN 7 AND 730 AND "evidenceRetentionDays" BETWEEN 30 AND 2555)
);

CREATE UNIQUE INDEX "ai_agent_governance_policies_agentId_key" ON "ai_agent_governance_policies"("agentId");
CREATE INDEX "ai_agent_governance_policies_businessId_idx" ON "ai_agent_governance_policies"("businessId");
ALTER TABLE "ai_agent_governance_policies" ADD CONSTRAINT "ai_agent_governance_policies_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_governance_policies" ADD CONSTRAINT "ai_agent_governance_policies_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 12: gradual production rollout and emergency controls
CREATE TABLE "ai_agent_rollout_configs" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "trafficPercentage" INTEGER NOT NULL DEFAULT 0,
  "killSwitch" BOOLEAN NOT NULL DEFAULT false,
  "fallbackToLegacy" BOOLEAN NOT NULL DEFAULT true,
  "maxFailureRate" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "maxHandoffRate" DOUBLE PRECISION NOT NULL DEFAULT 40,
  "minConfidence" DOUBLE PRECISION NOT NULL DEFAULT 50,
  "observationWindowMins" INTEGER NOT NULL DEFAULT 60,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_agent_rollout_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_agent_rollout_traffic_check" CHECK ("trafficPercentage" BETWEEN 0 AND 100),
  CONSTRAINT "ai_agent_rollout_rates_check" CHECK ("maxFailureRate" BETWEEN 0 AND 100 AND "maxHandoffRate" BETWEEN 0 AND 100 AND "minConfidence" BETWEEN 0 AND 100)
);

CREATE UNIQUE INDEX "ai_agent_rollout_configs_agentId_key" ON "ai_agent_rollout_configs"("agentId");
CREATE INDEX "ai_agent_rollout_configs_businessId_enabled_idx" ON "ai_agent_rollout_configs"("businessId", "enabled");
ALTER TABLE "ai_agent_rollout_configs" ADD CONSTRAINT "ai_agent_rollout_configs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_rollout_configs" ADD CONSTRAINT "ai_agent_rollout_configs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Phase 13: deterministic multi-agent intent/keyword routing
CREATE TABLE "ai_agent_routing_rules" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "intents" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isFallback" BOOLEAN NOT NULL DEFAULT false,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_agent_routing_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_agent_routing_rules_businessId_name_key" ON "ai_agent_routing_rules"("businessId", "name");
CREATE UNIQUE INDEX "ai_agent_routing_rules_one_fallback_key" ON "ai_agent_routing_rules"("businessId") WHERE "isFallback" = true AND "enabled" = true;
CREATE INDEX "ai_agent_routing_rules_businessId_enabled_priority_idx" ON "ai_agent_routing_rules"("businessId", "enabled", "priority");
CREATE INDEX "ai_agent_routing_rules_agentId_idx" ON "ai_agent_routing_rules"("agentId");
ALTER TABLE "ai_agent_routing_rules" ADD CONSTRAINT "ai_agent_routing_rules_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_routing_rules" ADD CONSTRAINT "ai_agent_routing_rules_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing active agents remain available but do not receive V2 traffic until an
-- operator explicitly enables rollout.
INSERT INTO "ai_agent_governance_policies" ("id", "businessId", "agentId", "updatedAt")
SELECT gen_random_uuid()::text, "businessId", "id", CURRENT_TIMESTAMP FROM "ai_agents"
ON CONFLICT ("agentId") DO NOTHING;

INSERT INTO "ai_agent_rollout_configs" ("id", "businessId", "agentId", "updatedAt")
SELECT gen_random_uuid()::text, "businessId", "id", CURRENT_TIMESTAMP FROM "ai_agents"
ON CONFLICT ("agentId") DO NOTHING;
