-- Enterprise AI + Human Handoff System

-- New enum values for conversation status
ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'AI_HANDLING';
ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'HUMAN_NEEDED';
ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'HUMAN_HANDLING';
ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_CUSTOMER';
ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'ESCALATED';
ALTER TYPE "ConversationStatus" ADD VALUE IF NOT EXISTS 'TRANSFERRED';

-- New enums
CREATE TYPE "ConversationTeam" AS ENUM ('SUPPORT', 'SALES', 'TECHNICAL', 'GENERAL');
CREATE TYPE "ResolutionMethod" AS ENUM ('AI', 'HUMAN', 'UNRESOLVED');
CREATE TYPE "ConversationActivityType" AS ENUM (
  'CREATED',
  'AI_STARTED',
  'CUSTOMER_REQUESTED_HUMAN',
  'TRANSFERRED',
  'ASSIGNED',
  'TAKEOVER',
  'RETURNED_TO_AI',
  'RESOLVED',
  'CLOSED',
  'FEEDBACK_SUBMITTED',
  'FEEDBACK_PROMPTED',
  'STATUS_CHANGED',
  'ESCALATED',
  'MESSAGE_RECEIVED'
);

-- Conversation handoff fields
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "assignedTeam" "ConversationTeam";
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "aiStartTime" TIMESTAMP(3);
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "humanStartTime" TIMESTAMP(3);
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "transferTime" TIMESTAMP(3);
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "aiConfidenceScore" DOUBLE PRECISION;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "resolutionMethod" "ResolutionMethod";
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "awaitingFeedback" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "feedbackPromptedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "conversations_businessId_assignedTeam_idx"
  ON "conversations"("businessId", "assignedTeam");

-- Activity timeline
CREATE TABLE IF NOT EXISTS "conversation_activities" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "type" "ConversationActivityType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "actorUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "conversation_activities_conversationId_createdAt_idx"
  ON "conversation_activities"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "conversation_activities_businessId_createdAt_idx"
  ON "conversation_activities"("businessId", "createdAt");

ALTER TABLE "conversation_activities"
  ADD CONSTRAINT "conversation_activities_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_activities"
  ADD CONSTRAINT "conversation_activities_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_activities"
  ADD CONSTRAINT "conversation_activities_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Customer satisfaction / feedback
CREATE TABLE IF NOT EXISTS "conversation_feedback" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "rating" INTEGER,
  "helpful" BOOLEAN,
  "resolutionMethod" "ResolutionMethod",
  "resolutionTimeMs" INTEGER,
  "employeeName" TEXT,
  "aiConfidenceScore" DOUBLE PRECISION,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "conversation_feedback_conversationId_idx"
  ON "conversation_feedback"("conversationId");
CREATE INDEX IF NOT EXISTS "conversation_feedback_businessId_createdAt_idx"
  ON "conversation_feedback"("businessId", "createdAt");

ALTER TABLE "conversation_feedback"
  ADD CONSTRAINT "conversation_feedback_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_feedback"
  ADD CONSTRAINT "conversation_feedback_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
