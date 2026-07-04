-- Enterprise governance: approval workflow, audit extensions, plan flags

CREATE TYPE "GovernanceActionType" AS ENUM (
  'AI_UPLOAD_DOCUMENT',
  'AI_DELETE_DOCUMENT',
  'AI_CREATE_FAQ',
  'AI_UPDATE_FAQ',
  'AI_DELETE_FAQ',
  'AI_CLEAR_KNOWLEDGE',
  'AI_UPDATE_PROFILE',
  'AI_UPLOAD_PROFILE_PDF',
  'AI_DELETE_PROFILE_PDF',
  'AI_CLEAR_PROFILE',
  'AI_REINDEX',
  'AI_RESET_MEMORY',
  'AI_DELETE_EMBEDDINGS',
  'WHATSAPP_CONNECT',
  'WHATSAPP_DISCONNECT'
);

CREATE TYPE "GovernanceApprovalStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'ACTIVATED',
  'EXPIRED',
  'CANCELLED'
);

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GOVERNANCE_REQUEST';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GOVERNANCE_APPROVE';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GOVERNANCE_REJECT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'GOVERNANCE_ACTIVATE';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GOVERNANCE_APPROVAL';

CREATE TABLE "governance_approval_requests" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "actionType" "GovernanceActionType" NOT NULL,
  "status" "GovernanceApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "previousData" JSONB,
  "stagingStorageKey" TEXT,
  "stagingMimeType" TEXT,
  "stagingFilename" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "deviceLabel" TEXT,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedByUserId" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "activationCodeHash" TEXT,
  "activationCodeExpiresAt" TIMESTAMP(3),
  "activationCodeUsedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "executionResult" JSONB,
  "auditEntityId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "governance_approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "governance_approval_requests_businessId_idx" ON "governance_approval_requests"("businessId");
CREATE INDEX "governance_approval_requests_status_idx" ON "governance_approval_requests"("status");
CREATE INDEX "governance_approval_requests_requesterUserId_idx" ON "governance_approval_requests"("requesterUserId");
CREATE INDEX "governance_approval_requests_actionType_idx" ON "governance_approval_requests"("actionType");
CREATE INDEX "governance_approval_requests_createdAt_idx" ON "governance_approval_requests"("createdAt");

ALTER TABLE "governance_approval_requests"
  ADD CONSTRAINT "governance_approval_requests_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "governance_approval_requests"
  ADD CONSTRAINT "governance_approval_requests_requesterUserId_fkey"
  FOREIGN KEY ("requesterUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "governance_approval_requests"
  ADD CONSTRAINT "governance_approval_requests_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "governance_approval_requests"
  ADD CONSTRAINT "governance_approval_requests_rejectedByUserId_fkey"
  FOREIGN KEY ("rejectedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Plan governance flags (merged into existing featureFlags JSON)
UPDATE "subscription_plans" SET
  "featureFlags" = COALESCE("featureFlags", '{}'::jsonb) || '{"aiTrainingManage":false,"whatsappSelfService":false}'::jsonb,
  "updatedAt" = NOW()
WHERE "code" IN ('FREE', 'STARTER', 'BUSINESS');

UPDATE "subscription_plans" SET
  "featureFlags" = COALESCE("featureFlags", '{}'::jsonb) || '{"aiTrainingManage":false,"whatsappSelfService":false}'::jsonb,
  "updatedAt" = NOW()
WHERE "code" = 'PROFESSIONAL';

UPDATE "subscription_plans" SET
  "featureFlags" = COALESCE("featureFlags", '{}'::jsonb) || '{"aiTrainingManage":true,"whatsappSelfService":true}'::jsonb,
  "updatedAt" = NOW()
WHERE "code" IN ('ENTERPRISE', 'CUSTOM');
