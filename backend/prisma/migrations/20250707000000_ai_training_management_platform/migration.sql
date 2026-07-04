-- AI Training Management Platform: workspaces, versions, jobs, sandbox, deployment, trainers

ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'CSV';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'XLSX';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'MARKDOWN';
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'HTML';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AI_DEPLOYMENT_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AI_TRAINING_COMPLETE';

CREATE TYPE "AiTrainingJobType" AS ENUM (
  'FULL_TRAIN',
  'RETRAIN',
  'PARTIAL_RETRAIN',
  'INCREMENTAL_RETRAIN',
  'EMBED_DOCUMENTS',
  'REINDEX',
  'EVALUATE'
);

CREATE TYPE "AiTrainingJobStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "AiTrainingVersionStatus" AS ENUM (
  'DRAFT',
  'SANDBOX',
  'PENDING_APPROVAL',
  'PRODUCTION',
  'ARCHIVED'
);

CREATE TYPE "AiDeploymentRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
  'DEPLOYED',
  'CANCELLED'
);

CREATE TYPE "AiSandboxMessageRole" AS ENUM (
  'USER',
  'ASSISTANT',
  'SYSTEM'
);

CREATE TYPE "AiTrainingAuditAction" AS ENUM (
  'TRAIN_STARTED',
  'TRAIN_COMPLETED',
  'TRAIN_FAILED',
  'VERSION_CREATED',
  'SANDBOX_TEST',
  'DEPLOYMENT_REQUESTED',
  'DEPLOYMENT_APPROVED',
  'DEPLOYMENT_REJECTED',
  'DEPLOYMENT_PUBLISHED',
  'VERSION_ROLLBACK',
  'DOCUMENT_UPLOADED',
  'TRAINER_LOGIN'
);

CREATE TABLE "ai_training_workspaces" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "productionVersionId" TEXT,
  "sandboxVersionId" TEXT,
  "lastTrainedAt" TIMESTAMP(3),
  "aiReadinessScore" DOUBLE PRECISION,
  "knowledgeScore" DOUBLE PRECISION,
  "confidenceScore" DOUBLE PRECISION,
  "embeddingCount" INTEGER NOT NULL DEFAULT 0,
  "documentCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_training_workspaces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_training_workspaces_businessId_key" ON "ai_training_workspaces"("businessId");
CREATE INDEX "ai_training_workspaces_businessId_idx" ON "ai_training_workspaces"("businessId");

CREATE TABLE "ai_trainers" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "permissions" JSONB NOT NULL DEFAULT '{}',
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_trainers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_trainers_username_key" ON "ai_trainers"("username");

CREATE TABLE "ai_training_versions" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "AiTrainingVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "trainingNotes" TEXT,
  "trainedByUserId" TEXT,
  "trainedByTrainerId" TEXT,
  "knowledgeScore" DOUBLE PRECISION,
  "confidenceScore" DOUBLE PRECISION,
  "readinessScore" DOUBLE PRECISION,
  "hallucinationRisk" DOUBLE PRECISION,
  "embeddingVersion" TEXT,
  "snapshotData" JSONB,
  "documentCount" INTEGER NOT NULL DEFAULT 0,
  "chunkCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_training_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_training_versions_businessId_versionNumber_key" ON "ai_training_versions"("businessId", "versionNumber");
CREATE INDEX "ai_training_versions_businessId_idx" ON "ai_training_versions"("businessId");
CREATE INDEX "ai_training_versions_workspaceId_idx" ON "ai_training_versions"("workspaceId");
CREATE INDEX "ai_training_versions_status_idx" ON "ai_training_versions"("status");

CREATE TABLE "ai_training_jobs" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "versionId" TEXT,
  "type" "AiTrainingJobType" NOT NULL,
  "status" "AiTrainingJobStatus" NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "totalSteps" INTEGER NOT NULL DEFAULT 0,
  "currentStep" TEXT,
  "error" TEXT,
  "payload" JSONB,
  "result" JSONB,
  "bullJobId" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdByTrainerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_training_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_training_jobs_businessId_idx" ON "ai_training_jobs"("businessId");
CREATE INDEX "ai_training_jobs_workspaceId_idx" ON "ai_training_jobs"("workspaceId");
CREATE INDEX "ai_training_jobs_status_idx" ON "ai_training_jobs"("status");
CREATE INDEX "ai_training_jobs_createdAt_idx" ON "ai_training_jobs"("createdAt");

CREATE TABLE "ai_deployment_requests" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "status" "AiDeploymentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedByTrainerId" TEXT,
  "requestedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "rejectedByUserId" TEXT,
  "knowledgeScore" DOUBLE PRECISION,
  "confidenceScore" DOUBLE PRECISION,
  "readinessScore" DOUBLE PRECISION,
  "sandboxTestSummary" JSONB,
  "deploymentSummary" TEXT,
  "rejectionReason" TEXT,
  "changeRequestNotes" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "deployedAt" TIMESTAMP(3),
  "ipAddress" TEXT,
  "userAgent" TEXT,

  CONSTRAINT "ai_deployment_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_deployment_requests_businessId_idx" ON "ai_deployment_requests"("businessId");
CREATE INDEX "ai_deployment_requests_versionId_idx" ON "ai_deployment_requests"("versionId");
CREATE INDEX "ai_deployment_requests_status_idx" ON "ai_deployment_requests"("status");

CREATE TABLE "ai_sandbox_sessions" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "trainerId" TEXT,
  "userId" TEXT,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_sandbox_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_sandbox_sessions_businessId_idx" ON "ai_sandbox_sessions"("businessId");
CREATE INDEX "ai_sandbox_sessions_versionId_idx" ON "ai_sandbox_sessions"("versionId");

CREATE TABLE "ai_sandbox_messages" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "role" "AiSandboxMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION,
  "sources" JSONB,
  "hallucinationRisk" DOUBLE PRECISION,
  "missingKnowledge" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_sandbox_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_sandbox_messages_sessionId_idx" ON "ai_sandbox_messages"("sessionId");

CREATE TABLE "ai_trainer_businesses" (
  "trainerId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_trainer_businesses_pkey" PRIMARY KEY ("trainerId","businessId")
);

CREATE INDEX "ai_trainer_businesses_businessId_idx" ON "ai_trainer_businesses"("businessId");

CREATE TABLE "ai_trainer_login_history" (
  "id" TEXT NOT NULL,
  "trainerId" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "deviceLabel" TEXT,
  "success" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_trainer_login_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_trainer_login_history_trainerId_idx" ON "ai_trainer_login_history"("trainerId");
CREATE INDEX "ai_trainer_login_history_createdAt_idx" ON "ai_trainer_login_history"("createdAt");

CREATE TABLE "ai_training_insights" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "metadata" JSONB,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_training_insights_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_training_insights_businessId_idx" ON "ai_training_insights"("businessId");
CREATE INDEX "ai_training_insights_type_idx" ON "ai_training_insights"("type");

CREATE TABLE "ai_training_audit_logs" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "versionId" TEXT,
  "trainerId" TEXT,
  "userId" TEXT,
  "action" "AiTrainingAuditAction" NOT NULL,
  "entity" TEXT,
  "entityId" TEXT,
  "oldData" JSONB,
  "newData" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "deviceLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_training_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_training_audit_logs_businessId_idx" ON "ai_training_audit_logs"("businessId");
CREATE INDEX "ai_training_audit_logs_versionId_idx" ON "ai_training_audit_logs"("versionId");
CREATE INDEX "ai_training_audit_logs_action_idx" ON "ai_training_audit_logs"("action");
CREATE INDEX "ai_training_audit_logs_createdAt_idx" ON "ai_training_audit_logs"("createdAt");

-- Foreign keys (versions before workspace version pointers)
ALTER TABLE "ai_training_workspaces"
  ADD CONSTRAINT "ai_training_workspaces_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_training_versions"
  ADD CONSTRAINT "ai_training_versions_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "ai_training_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_training_versions"
  ADD CONSTRAINT "ai_training_versions_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_training_versions"
  ADD CONSTRAINT "ai_training_versions_trainedByUserId_fkey"
  FOREIGN KEY ("trainedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_training_versions"
  ADD CONSTRAINT "ai_training_versions_trainedByTrainerId_fkey"
  FOREIGN KEY ("trainedByTrainerId") REFERENCES "ai_trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_training_workspaces"
  ADD CONSTRAINT "ai_training_workspaces_productionVersionId_fkey"
  FOREIGN KEY ("productionVersionId") REFERENCES "ai_training_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_training_workspaces"
  ADD CONSTRAINT "ai_training_workspaces_sandboxVersionId_fkey"
  FOREIGN KEY ("sandboxVersionId") REFERENCES "ai_training_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_training_jobs"
  ADD CONSTRAINT "ai_training_jobs_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_training_jobs"
  ADD CONSTRAINT "ai_training_jobs_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "ai_training_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_training_jobs"
  ADD CONSTRAINT "ai_training_jobs_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "ai_training_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_training_jobs"
  ADD CONSTRAINT "ai_training_jobs_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_training_jobs"
  ADD CONSTRAINT "ai_training_jobs_createdByTrainerId_fkey"
  FOREIGN KEY ("createdByTrainerId") REFERENCES "ai_trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_deployment_requests"
  ADD CONSTRAINT "ai_deployment_requests_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_deployment_requests"
  ADD CONSTRAINT "ai_deployment_requests_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "ai_training_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_deployment_requests"
  ADD CONSTRAINT "ai_deployment_requests_requestedByTrainerId_fkey"
  FOREIGN KEY ("requestedByTrainerId") REFERENCES "ai_trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_deployment_requests"
  ADD CONSTRAINT "ai_deployment_requests_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_deployment_requests"
  ADD CONSTRAINT "ai_deployment_requests_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_deployment_requests"
  ADD CONSTRAINT "ai_deployment_requests_rejectedByUserId_fkey"
  FOREIGN KEY ("rejectedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_sandbox_sessions"
  ADD CONSTRAINT "ai_sandbox_sessions_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_sandbox_sessions"
  ADD CONSTRAINT "ai_sandbox_sessions_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "ai_training_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_sandbox_sessions"
  ADD CONSTRAINT "ai_sandbox_sessions_trainerId_fkey"
  FOREIGN KEY ("trainerId") REFERENCES "ai_trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_sandbox_sessions"
  ADD CONSTRAINT "ai_sandbox_sessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_sandbox_messages"
  ADD CONSTRAINT "ai_sandbox_messages_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "ai_sandbox_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_trainer_businesses"
  ADD CONSTRAINT "ai_trainer_businesses_trainerId_fkey"
  FOREIGN KEY ("trainerId") REFERENCES "ai_trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_trainer_businesses"
  ADD CONSTRAINT "ai_trainer_businesses_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_trainer_login_history"
  ADD CONSTRAINT "ai_trainer_login_history_trainerId_fkey"
  FOREIGN KEY ("trainerId") REFERENCES "ai_trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_training_insights"
  ADD CONSTRAINT "ai_training_insights_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_training_audit_logs"
  ADD CONSTRAINT "ai_training_audit_logs_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "ai_training_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_training_audit_logs"
  ADD CONSTRAINT "ai_training_audit_logs_trainerId_fkey"
  FOREIGN KEY ("trainerId") REFERENCES "ai_trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_training_audit_logs"
  ADD CONSTRAINT "ai_training_audit_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
