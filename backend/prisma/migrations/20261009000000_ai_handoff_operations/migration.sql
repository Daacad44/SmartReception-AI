CREATE TYPE "AiHandoffStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'AI_RESUMED', 'CANCELLED');
CREATE TYPE "AiHandoffPriority" AS ENUM ('NORMAL', 'HIGH', 'URGENT');

CREATE TABLE "ai_handoff_cases" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "agentExecutionId" TEXT,
  "status" "AiHandoffStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "AiHandoffPriority" NOT NULL DEFAULT 'NORMAL',
  "reason" TEXT NOT NULL,
  "contextSnapshot" JSONB NOT NULL,
  "assignedToUserId" TEXT,
  "assignedTeam" "ConversationTeam",
  "slaDueAt" TIMESTAMP(3) NOT NULL,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedById" TEXT,
  "resolutionSummary" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "aiResumeSummary" TEXT,
  "aiResumedAt" TIMESTAMP(3),
  "aiResumedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_handoff_cases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_handoff_cases_agentExecutionId_key" ON "ai_handoff_cases"("agentExecutionId");
CREATE UNIQUE INDEX "ai_handoff_cases_one_active_conversation_key" ON "ai_handoff_cases"("conversationId") WHERE "status" IN ('OPEN', 'ACKNOWLEDGED');
CREATE INDEX "ai_handoff_cases_businessId_status_priority_createdAt_idx" ON "ai_handoff_cases"("businessId", "status", "priority", "createdAt");
CREATE INDEX "ai_handoff_cases_assignedToUserId_status_idx" ON "ai_handoff_cases"("assignedToUserId", "status");
CREATE INDEX "ai_handoff_cases_slaDueAt_status_idx" ON "ai_handoff_cases"("slaDueAt", "status");

ALTER TABLE "ai_handoff_cases" ADD CONSTRAINT "ai_handoff_cases_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_handoff_cases" ADD CONSTRAINT "ai_handoff_cases_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_handoff_cases" ADD CONSTRAINT "ai_handoff_cases_agentExecutionId_fkey" FOREIGN KEY ("agentExecutionId") REFERENCES "ai_agent_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve existing in-flight human conversations during rollout.
INSERT INTO "ai_handoff_cases" (
  "id", "businessId", "conversationId", "status", "priority", "reason",
  "contextSnapshot", "assignedToUserId", "assignedTeam", "slaDueAt",
  "acknowledgedAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text, conversation."businessId", conversation."id",
  CASE WHEN conversation."status" = 'HUMAN_HANDLING' THEN 'ACKNOWLEDGED'::"AiHandoffStatus" ELSE 'OPEN'::"AiHandoffStatus" END,
  'NORMAL'::"AiHandoffPriority", 'Migrated active human handoff',
  jsonb_build_object('source', 'migration', 'conversationStatus', conversation."status"),
  conversation."assignedToId", conversation."assignedTeam",
  COALESCE(conversation."transferTime", CURRENT_TIMESTAMP) + INTERVAL '30 minutes',
  CASE WHEN conversation."status" = 'HUMAN_HANDLING' THEN COALESCE(conversation."humanStartTime", CURRENT_TIMESTAMP) ELSE NULL END,
  COALESCE(conversation."transferTime", CURRENT_TIMESTAMP), CURRENT_TIMESTAMP
FROM "conversations" conversation
WHERE conversation."status" IN ('HUMAN_NEEDED', 'HUMAN_HANDLING');
