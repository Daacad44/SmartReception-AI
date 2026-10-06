-- AI Agent Studio Phase 2: additive domain foundation and legacy backfill.

CREATE TYPE "AiAgentType" AS ENUM ('RECEPTION', 'SALES', 'SUPPORT', 'BOOKING', 'MIXED');
CREATE TYPE "AiAgentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "AiAgentReleaseStatus" AS ENUM ('DRAFT', 'BUILDING', 'EVALUATING', 'FAILED', 'READY_FOR_REVIEW', 'APPROVED', 'ACTIVE', 'RETIRED');
CREATE TYPE "AiAgentApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "AiAgentExecutionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'HANDED_OVER', 'CANCELLED');
CREATE TYPE "AiAgentEvaluationStatus" AS ENUM ('QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'CANCELLED');
CREATE TYPE "AiAgentSkillRisk" AS ENUM ('READ_ONLY', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE "ai_agents" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" "AiAgentType" NOT NULL DEFAULT 'MIXED',
  "status" "AiAgentStatus" NOT NULL DEFAULT 'DRAFT',
  "description" TEXT,
  "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
  "defaultLanguage" TEXT NOT NULL DEFAULT 'so',
  "supportedLanguages" TEXT[] NOT NULL DEFAULT ARRAY['so', 'en']::TEXT[],
  "activeReleaseId" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_agents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_agent_drafts" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "instructions" JSONB NOT NULL DEFAULT '{}',
  "behaviorConfig" JSONB NOT NULL DEFAULT '{}',
  "knowledgeConfig" JSONB NOT NULL DEFAULT '{}',
  "escalationPolicy" JSONB NOT NULL DEFAULT '{}',
  "modelConfig" JSONB NOT NULL DEFAULT '{}',
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_agent_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_agent_releases" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "releaseNumber" INTEGER NOT NULL,
  "status" "AiAgentReleaseStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceTrainingVersionId" TEXT,
  "snapshotData" JSONB NOT NULL,
  "evaluationSummary" JSONB,
  "changeSummary" TEXT,
  "createdByUserId" TEXT,
  "activatedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_agent_releases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_agent_release_approvals" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "status" "AiAgentApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT,
  "reviewedById" TEXT,
  "reviewNotes" TEXT,
  "rejectionReason" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "ai_agent_release_approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_agent_skill_configurations" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "skillKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "riskLevel" "AiAgentSkillRisk" NOT NULL DEFAULT 'READ_ONLY',
  "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
  "configuration" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_agent_skill_configurations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_agent_executions" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "releaseId" TEXT,
  "conversationId" TEXT,
  "inboundMessageId" TEXT,
  "status" "AiAgentExecutionStatus" NOT NULL DEFAULT 'RUNNING',
  "intent" TEXT,
  "input" JSONB,
  "retrievedSources" JSONB,
  "proposedActions" JSONB,
  "executedActions" JSONB,
  "response" JSONB,
  "confidence" DOUBLE PRECISION,
  "latencyMs" INTEGER,
  "tokensUsed" INTEGER NOT NULL DEFAULT 0,
  "estimatedCost" DECIMAL(12,6) NOT NULL DEFAULT 0,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ai_agent_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_agent_evaluation_runs" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "status" "AiAgentEvaluationStatus" NOT NULL DEFAULT 'QUEUED',
  "overallScore" DOUBLE PRECISION,
  "criticalFailures" INTEGER NOT NULL DEFAULT 0,
  "summary" JSONB,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_agent_evaluation_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_agent_evaluation_cases" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "caseKey" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "expected" JSONB,
  "actual" JSONB,
  "score" DOUBLE PRECISION,
  "passed" BOOLEAN,
  "criticalFailure" BOOLEAN NOT NULL DEFAULT false,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_agent_evaluation_cases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_agents_businessId_slug_key" ON "ai_agents"("businessId", "slug");
CREATE UNIQUE INDEX "ai_agents_activeReleaseId_key" ON "ai_agents"("activeReleaseId");
CREATE INDEX "ai_agents_businessId_status_idx" ON "ai_agents"("businessId", "status");
CREATE UNIQUE INDEX "ai_agent_drafts_agentId_key" ON "ai_agent_drafts"("agentId");
CREATE UNIQUE INDEX "ai_agent_releases_sourceTrainingVersionId_key" ON "ai_agent_releases"("sourceTrainingVersionId");
CREATE UNIQUE INDEX "ai_agent_releases_agentId_releaseNumber_key" ON "ai_agent_releases"("agentId", "releaseNumber");
CREATE INDEX "ai_agent_releases_businessId_status_idx" ON "ai_agent_releases"("businessId", "status");
CREATE INDEX "ai_agent_release_approvals_releaseId_status_idx" ON "ai_agent_release_approvals"("releaseId", "status");
CREATE UNIQUE INDEX "ai_agent_skills_agentId_skillKey_key" ON "ai_agent_skill_configurations"("agentId", "skillKey");
CREATE INDEX "ai_agent_skills_agentId_enabled_idx" ON "ai_agent_skill_configurations"("agentId", "enabled");
CREATE INDEX "ai_agent_executions_businessId_startedAt_idx" ON "ai_agent_executions"("businessId", "startedAt");
CREATE INDEX "ai_agent_executions_agentId_status_idx" ON "ai_agent_executions"("agentId", "status");
CREATE INDEX "ai_agent_executions_conversationId_idx" ON "ai_agent_executions"("conversationId");
CREATE INDEX "ai_agent_evaluation_runs_businessId_createdAt_idx" ON "ai_agent_evaluation_runs"("businessId", "createdAt");
CREATE INDEX "ai_agent_evaluation_runs_releaseId_status_idx" ON "ai_agent_evaluation_runs"("releaseId", "status");
CREATE UNIQUE INDEX "ai_agent_evaluation_cases_runId_caseKey_key" ON "ai_agent_evaluation_cases"("runId", "caseKey");
CREATE INDEX "ai_agent_evaluation_cases_runId_category_idx" ON "ai_agent_evaluation_cases"("runId", "category");

ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_agent_drafts" ADD CONSTRAINT "ai_agent_drafts_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_drafts" ADD CONSTRAINT "ai_agent_drafts_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_agent_releases" ADD CONSTRAINT "ai_agent_releases_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_releases" ADD CONSTRAINT "ai_agent_releases_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_releases" ADD CONSTRAINT "ai_agent_releases_sourceTrainingVersionId_fkey" FOREIGN KEY ("sourceTrainingVersionId") REFERENCES "ai_training_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_agent_releases" ADD CONSTRAINT "ai_agent_releases_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_agent_release_approvals" ADD CONSTRAINT "ai_agent_release_approvals_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ai_agent_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_release_approvals" ADD CONSTRAINT "ai_agent_release_approvals_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_agent_release_approvals" ADD CONSTRAINT "ai_agent_release_approvals_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_agent_skill_configurations" ADD CONSTRAINT "ai_agent_skills_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_executions" ADD CONSTRAINT "ai_agent_executions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_executions" ADD CONSTRAINT "ai_agent_executions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_executions" ADD CONSTRAINT "ai_agent_executions_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ai_agent_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_agent_evaluation_runs" ADD CONSTRAINT "ai_agent_evaluation_runs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_evaluation_runs" ADD CONSTRAINT "ai_agent_evaluation_runs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_evaluation_runs" ADD CONSTRAINT "ai_agent_evaluation_runs_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ai_agent_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_evaluation_cases" ADD CONSTRAINT "ai_agent_evaluation_cases_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ai_agent_evaluation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create one backward-compatible WhatsApp agent per existing business.
INSERT INTO "ai_agents" (
  "id", "businessId", "name", "slug", "type", "status", "description",
  "channel", "defaultLanguage", "supportedLanguages", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), business."id", business."name" || ' WhatsApp Agent',
       'whatsapp-agent', 'MIXED',
       CASE WHEN workspace."productionVersionId" IS NULL THEN 'DRAFT'::"AiAgentStatus" ELSE 'ACTIVE'::"AiAgentStatus" END,
       'Migrated from the legacy AI Training workspace', 'WHATSAPP', 'so',
       ARRAY['so', 'en']::TEXT[], CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "businesses" AS business
LEFT JOIN "ai_training_workspaces" AS workspace ON workspace."businessId" = business."id"
ON CONFLICT ("businessId", "slug") DO NOTHING;

INSERT INTO "ai_agent_drafts" (
  "id", "agentId", "instructions", "behaviorConfig", "knowledgeConfig",
  "escalationPolicy", "modelConfig", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), agent."id",
       jsonb_build_object('role', 'WhatsApp business assistant', 'source', 'legacy-training-migration'),
       jsonb_build_object('channel', 'WHATSAPP', 'defaultLanguage', agent."defaultLanguage"),
       jsonb_build_object('legacyWorkspaceId', workspace."id", 'sandboxVersionId', workspace."sandboxVersionId"),
       jsonb_build_object('handoverOnMissingKnowledge', true, 'handoverOnLowConfidence', true),
       jsonb_build_object('provider', 'configured-default'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ai_agents" AS agent
LEFT JOIN "ai_training_workspaces" AS workspace ON workspace."businessId" = agent."businessId"
ON CONFLICT ("agentId") DO NOTHING;

INSERT INTO "ai_agent_skill_configurations" (
  "id", "agentId", "skillKey", "enabled", "riskLevel",
  "requiresConfirmation", "configuration", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), agent."id", skill."skillKey", skill."enabled",
       skill."riskLevel"::"AiAgentSkillRisk", skill."requiresConfirmation",
       '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ai_agents" AS agent
CROSS JOIN (VALUES
  ('knowledge.search', true, 'READ_ONLY', false),
  ('appointment.check_availability', true, 'READ_ONLY', false),
  ('human.handover', true, 'LOW', false),
  ('appointment.create', false, 'MEDIUM', true)
) AS skill("skillKey", "enabled", "riskLevel", "requiresConfirmation")
ON CONFLICT ("agentId", "skillKey") DO NOTHING;

INSERT INTO "ai_agent_releases" (
  "id", "agentId", "businessId", "releaseNumber", "status",
  "sourceTrainingVersionId", "snapshotData", "evaluationSummary", "changeSummary",
  "createdByUserId", "activatedAt", "retiredAt", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), agent."id", version."businessId", version."versionNumber",
       CASE version."status"
         WHEN 'PRODUCTION' THEN 'ACTIVE'::"AiAgentReleaseStatus"
         WHEN 'ARCHIVED' THEN 'RETIRED'::"AiAgentReleaseStatus"
         WHEN 'PENDING_APPROVAL' THEN 'READY_FOR_REVIEW'::"AiAgentReleaseStatus"
         WHEN 'SANDBOX' THEN 'READY_FOR_REVIEW'::"AiAgentReleaseStatus"
         ELSE 'DRAFT'::"AiAgentReleaseStatus"
       END,
       version."id",
       jsonb_build_object(
         'schemaVersion', 1,
         'channel', 'WHATSAPP',
         'legacyTrainingVersionId', version."id",
         'knowledgeSnapshot', COALESCE(version."snapshotData", '{}'::jsonb)
       ),
       jsonb_build_object(
         'knowledgeScore', version."knowledgeScore",
         'confidenceScore', version."confidenceScore",
         'readinessScore', version."readinessScore",
         'hallucinationRisk', version."hallucinationRisk"
       ),
       'Migrated from legacy training version ' || version."versionNumber",
       version."trainedByUserId",
       CASE WHEN version."status" = 'PRODUCTION' THEN version."updatedAt" ELSE NULL END,
       CASE WHEN version."status" = 'ARCHIVED' THEN version."updatedAt" ELSE NULL END,
       version."createdAt", version."updatedAt"
FROM "ai_training_versions" AS version
JOIN "ai_agents" AS agent
  ON agent."businessId" = version."businessId" AND agent."slug" = 'whatsapp-agent'
ON CONFLICT ("sourceTrainingVersionId") DO NOTHING;

UPDATE "ai_agents" AS agent
SET "activeReleaseId" = release."id", "status" = 'ACTIVE', "updatedAt" = CURRENT_TIMESTAMP
FROM "ai_agent_releases" AS release
WHERE release."agentId" = agent."id" AND release."status" = 'ACTIVE';

ALTER TABLE "ai_agents" ADD CONSTRAINT "ai_agents_activeReleaseId_fkey" FOREIGN KEY ("activeReleaseId") REFERENCES "ai_agent_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ai_agent_release_approvals" (
  "id", "releaseId", "status", "requestedById", "reviewedById",
  "reviewNotes", "rejectionReason", "requestedAt", "reviewedAt"
)
SELECT gen_random_uuid(), release."id",
       CASE request."status"
         WHEN 'APPROVED' THEN 'APPROVED'::"AiAgentApprovalStatus"
         WHEN 'DEPLOYED' THEN 'APPROVED'::"AiAgentApprovalStatus"
         WHEN 'REJECTED' THEN 'REJECTED'::"AiAgentApprovalStatus"
         WHEN 'CANCELLED' THEN 'CANCELLED'::"AiAgentApprovalStatus"
         ELSE 'PENDING'::"AiAgentApprovalStatus"
       END,
       request."requestedByUserId", COALESCE(request."approvedByUserId", request."rejectedByUserId"),
       request."changeRequestNotes", request."rejectionReason", request."requestedAt", request."reviewedAt"
FROM "ai_deployment_requests" AS request
JOIN "ai_agent_releases" AS release ON release."sourceTrainingVersionId" = request."versionId";
