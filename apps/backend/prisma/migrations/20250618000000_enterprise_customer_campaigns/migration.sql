-- AlterEnum
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'PREMIUM';
ALTER TYPE "CustomerType" ADD VALUE IF NOT EXISTS 'PROSPECT';

-- AlterEnum
ALTER TYPE "CampaignSchedule" ADD VALUE IF NOT EXISTS 'CUSTOM';

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "country" TEXT;

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "templateId" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "sendToAll" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "responseCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "linkClickCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "campaign_recipients" ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3);
ALTER TABLE "campaign_recipients" ADD COLUMN IF NOT EXISTS "clickedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "message_templates" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "CampaignType" NOT NULL DEFAULT 'MARKETING',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "customer_import_jobs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "report" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "customer_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "message_templates_businessId_idx" ON "message_templates"("businessId");
CREATE UNIQUE INDEX IF NOT EXISTS "message_templates_businessId_name_key" ON "message_templates"("businessId", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customer_import_jobs_businessId_idx" ON "customer_import_jobs"("businessId");
CREATE INDEX IF NOT EXISTS "customer_import_jobs_businessId_createdAt_idx" ON "customer_import_jobs"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "campaigns_templateId_idx" ON "campaigns"("templateId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_import_jobs" ADD CONSTRAINT "customer_import_jobs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "customer_import_jobs" ADD CONSTRAINT "customer_import_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
