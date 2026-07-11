-- Sandbox AI Validation Workflow.
-- Adds production-grade diagnostics to sandbox messages and a knowledge-gap
-- report so Super Admin can validate an AI version before deployment.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AiKnowledgeGapStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable: sandbox message diagnostics (super-admin visibility)
ALTER TABLE "ai_sandbox_messages" ADD COLUMN IF NOT EXISTS "groundedConfidence" DOUBLE PRECISION;
ALTER TABLE "ai_sandbox_messages" ADD COLUMN IF NOT EXISTS "intent" TEXT;
ALTER TABLE "ai_sandbox_messages" ADD COLUMN IF NOT EXISTS "route" TEXT;
ALTER TABLE "ai_sandbox_messages" ADD COLUMN IF NOT EXISTS "modelUsed" TEXT;
ALTER TABLE "ai_sandbox_messages" ADD COLUMN IF NOT EXISTS "provider" TEXT;
ALTER TABLE "ai_sandbox_messages" ADD COLUMN IF NOT EXISTS "retrievedChunkCount" INTEGER;
ALTER TABLE "ai_sandbox_messages" ADD COLUMN IF NOT EXISTS "embeddingMatchScore" DOUBLE PRECISION;
ALTER TABLE "ai_sandbox_messages" ADD COLUMN IF NOT EXISTS "latencyMs" INTEGER;

-- CreateTable: knowledge-gap / missing-knowledge report
CREATE TABLE IF NOT EXISTS "ai_knowledge_gaps" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "versionId" TEXT,
  "sessionId" TEXT,
  "question" TEXT NOT NULL,
  "normalizedQuestion" TEXT NOT NULL,
  "category" TEXT,
  "intent" TEXT,
  "frequency" INTEGER NOT NULL DEFAULT 1,
  "groundedConfidence" DOUBLE PRECISION,
  "hallucinationRisk" DOUBLE PRECISION,
  "recommendation" TEXT,
  "status" "AiKnowledgeGapStatus" NOT NULL DEFAULT 'OPEN',
  "source" TEXT NOT NULL DEFAULT 'SANDBOX',
  "resolvedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "firstAskedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAskedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_knowledge_gaps_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "ai_knowledge_gaps_businessId_normalizedQuestion_key"
  ON "ai_knowledge_gaps" ("businessId", "normalizedQuestion");
CREATE INDEX IF NOT EXISTS "ai_knowledge_gaps_businessId_idx" ON "ai_knowledge_gaps" ("businessId");
CREATE INDEX IF NOT EXISTS "ai_knowledge_gaps_status_idx" ON "ai_knowledge_gaps" ("status");
CREATE INDEX IF NOT EXISTS "ai_knowledge_gaps_businessId_status_idx"
  ON "ai_knowledge_gaps" ("businessId", "status");

-- Foreign key
DO $$ BEGIN
  ALTER TABLE "ai_knowledge_gaps"
    ADD CONSTRAINT "ai_knowledge_gaps_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "businesses" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
