CREATE TYPE "AiAgentActionType" AS ENUM ('APPOINTMENT_CREATE', 'LEAD_CAPTURE', 'ORDER_CREATE');
CREATE TYPE "AiAgentActionStatus" AS ENUM ('PROPOSED', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'EXECUTING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "ai_agent_actions" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "type" "AiAgentActionType" NOT NULL,
  "status" "AiAgentActionStatus" NOT NULL DEFAULT 'PROPOSED',
  "idempotencyKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "result" JSONB,
  "requiresConfirmation" BOOLEAN NOT NULL DEFAULT true,
  "confirmationPrompt" TEXT,
  "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmationDueAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "confirmedBy" TEXT,
  "executedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_agent_actions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_agent_actions_idempotencyKey_key" ON "ai_agent_actions"("idempotencyKey");
CREATE UNIQUE INDEX "ai_agent_actions_one_pending_confirmation_key" ON "ai_agent_actions"("conversationId", "type") WHERE "status" = 'AWAITING_CONFIRMATION';
CREATE INDEX "ai_agent_actions_businessId_status_createdAt_idx" ON "ai_agent_actions"("businessId", "status", "createdAt");
CREATE INDEX "ai_agent_actions_conversationId_status_idx" ON "ai_agent_actions"("conversationId", "status");
CREATE INDEX "ai_agent_actions_confirmationDueAt_status_idx" ON "ai_agent_actions"("confirmationDueAt", "status");

ALTER TABLE "ai_agent_actions" ADD CONSTRAINT "ai_agent_actions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_actions" ADD CONSTRAINT "ai_agent_actions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_actions" ADD CONSTRAINT "ai_agent_actions_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "ai_agent_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
