-- Enterprise AI Training Center: OTP verification + session logs

CREATE TYPE "AiTrainingOperation" AS ENUM (
  'TRAIN_ONE',
  'RETRAIN_ONE',
  'TRAIN_MULTIPLE',
  'TRAIN_ALL',
  'REBUILD_EMBEDDINGS',
  'REINDEX',
  'VALIDATE',
  'OPTIMIZE',
  'DELETE_OLD_EMBEDDINGS',
  'GENERATE_EMBEDDINGS',
  'PREVIEW',
  'ROLLBACK',
  'COMPARE_VERSIONS'
);

CREATE TYPE "AiTrainingVerificationStatus" AS ENUM (
  'PENDING_OTP',
  'VERIFIED',
  'EXPIRED',
  'FAILED',
  'EXECUTED',
  'CANCELLED'
);

ALTER TYPE "AiTrainingAuditAction" ADD VALUE IF NOT EXISTS 'TRAINING_OTP_REQUESTED';
ALTER TYPE "AiTrainingAuditAction" ADD VALUE IF NOT EXISTS 'TRAINING_OTP_VERIFIED';
ALTER TYPE "AiTrainingAuditAction" ADD VALUE IF NOT EXISTS 'TRAINING_OTP_FAILED';
ALTER TYPE "AiTrainingAuditAction" ADD VALUE IF NOT EXISTS 'TRAINING_VALIDATED';
ALTER TYPE "AiTrainingAuditAction" ADD VALUE IF NOT EXISTS 'INCREMENTAL_RETRAIN';
ALTER TYPE "AiTrainingAuditAction" ADD VALUE IF NOT EXISTS 'REINDEX_STARTED';
ALTER TYPE "AiTrainingAuditAction" ADD VALUE IF NOT EXISTS 'EMBEDDINGS_REBUILT';
ALTER TYPE "AiTrainingAuditAction" ADD VALUE IF NOT EXISTS 'KNOWLEDGE_OPTIMIZED';

ALTER TABLE "ai_training_workspaces" ADD COLUMN IF NOT EXISTS "lastRetrainedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ai_training_verification_requests" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "operation" "AiTrainingOperation" NOT NULL,
  "jobType" "AiTrainingJobType",
  "businessIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "payload" JSONB,
  "otpHash" TEXT,
  "otpExpiresAt" TIMESTAMP(3),
  "otpAttempts" INTEGER NOT NULL DEFAULT 0,
  "status" "AiTrainingVerificationStatus" NOT NULL DEFAULT 'PENDING_OTP',
  "verifiedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_training_verification_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_training_session_logs" (
  "id" TEXT NOT NULL,
  "jobId" TEXT,
  "businessId" TEXT NOT NULL,
  "operatorUserId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "trainingType" "AiTrainingJobType" NOT NULL,
  "knowledgeCount" INTEGER NOT NULL DEFAULT 0,
  "documentsCount" INTEGER NOT NULL DEFAULT 0,
  "faqCount" INTEGER NOT NULL DEFAULT 0,
  "productCount" INTEGER NOT NULL DEFAULT 0,
  "serviceCount" INTEGER NOT NULL DEFAULT 0,
  "embeddingsCreated" INTEGER NOT NULL DEFAULT 0,
  "embeddingsUpdated" INTEGER NOT NULL DEFAULT 0,
  "embeddingsDeleted" INTEGER NOT NULL DEFAULT 0,
  "tokensUsed" INTEGER NOT NULL DEFAULT 0,
  "estimatedCost" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "warnings" JSONB,
  "errors" JSONB,
  "validationResult" JSONB,
  "qualityScore" DOUBLE PRECISION,
  "status" "AiTrainingJobStatus" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_training_session_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_training_session_logs_jobId_key" ON "ai_training_session_logs"("jobId");
CREATE INDEX IF NOT EXISTS "ai_training_verification_requests_userId_idx" ON "ai_training_verification_requests"("userId");
CREATE INDEX IF NOT EXISTS "ai_training_verification_requests_status_idx" ON "ai_training_verification_requests"("status");
CREATE INDEX IF NOT EXISTS "ai_training_verification_requests_createdAt_idx" ON "ai_training_verification_requests"("createdAt");
CREATE INDEX IF NOT EXISTS "ai_training_session_logs_businessId_idx" ON "ai_training_session_logs"("businessId");
CREATE INDEX IF NOT EXISTS "ai_training_session_logs_operatorUserId_idx" ON "ai_training_session_logs"("operatorUserId");
CREATE INDEX IF NOT EXISTS "ai_training_session_logs_trainingType_idx" ON "ai_training_session_logs"("trainingType");
CREATE INDEX IF NOT EXISTS "ai_training_session_logs_status_idx" ON "ai_training_session_logs"("status");
CREATE INDEX IF NOT EXISTS "ai_training_session_logs_createdAt_idx" ON "ai_training_session_logs"("createdAt");

ALTER TABLE "ai_training_verification_requests"
  ADD CONSTRAINT "ai_training_verification_requests_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_training_session_logs"
  ADD CONSTRAINT "ai_training_session_logs_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_training_session_logs"
  ADD CONSTRAINT "ai_training_session_logs_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "ai_training_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_training_session_logs"
  ADD CONSTRAINT "ai_training_session_logs_operatorUserId_fkey"
  FOREIGN KEY ("operatorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
