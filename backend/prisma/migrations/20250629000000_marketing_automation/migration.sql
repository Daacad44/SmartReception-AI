-- Marketing Automation & Smart Campaign Scheduler

CREATE TYPE "CampaignMessageType" AS ENUM ('TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO', 'LOCATION', 'INTERACTIVE', 'TEMPLATE');
CREATE TYPE "JourneyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "JourneyEnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED');

ALTER TYPE "CampaignType" ADD VALUE IF NOT EXISTS 'WELCOME';
ALTER TYPE "CampaignType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_REMINDER';
ALTER TYPE "CampaignType" ADD VALUE IF NOT EXISTS 'BIRTHDAY';
ALTER TYPE "CampaignType" ADD VALUE IF NOT EXISTS 'PAYMENT_REMINDER';
ALTER TYPE "CampaignType" ADD VALUE IF NOT EXISTS 'INVOICE';
ALTER TYPE "CampaignType" ADD VALUE IF NOT EXISTS 'PRODUCT_LAUNCH';
ALTER TYPE "CampaignType" ADD VALUE IF NOT EXISTS 'SEASONAL';
ALTER TYPE "CampaignType" ADD VALUE IF NOT EXISTS 'DISCOUNT';
ALTER TYPE "CampaignType" ADD VALUE IF NOT EXISTS 'RETENTION';
ALTER TYPE "CampaignType" ADD VALUE IF NOT EXISTS 'RE_ENGAGEMENT';
ALTER TYPE "CampaignType" ADD VALUE IF NOT EXISTS 'THANK_YOU';
ALTER TYPE "CampaignType" ADD VALUE IF NOT EXISTS 'CUSTOM';

ALTER TYPE "CampaignSchedule" ADD VALUE IF NOT EXISTS 'YEARLY';
ALTER TYPE "CampaignSchedule" ADD VALUE IF NOT EXISTS 'RECURRING';

ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'RUNNING';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'PAUSED';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "messageType" "CampaignMessageType" NOT NULL DEFAULT 'TEXT';
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "timezone" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "cronExpression" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "scheduleConfig" JSONB;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "repeatCount" INTEGER;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "repeatUntil" TIMESTAMP(3);
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "runsCompleted" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "mediaFilename" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "journeyId" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "optOutCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "blockedCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "category" TEXT;
CREATE INDEX IF NOT EXISTS "message_templates_businessId_category_idx" ON "message_templates"("businessId", "category");

CREATE TABLE IF NOT EXISTS "campaign_journeys" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "JourneyStatus" NOT NULL DEFAULT 'DRAFT',
    "triggerType" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaign_journeys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "campaign_journey_steps" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL,
    "messageType" "CampaignMessageType" NOT NULL DEFAULT 'TEXT',
    "mediaUrl" TEXT,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaign_journey_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "campaign_journey_enrollments" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" "JourneyEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "nextStepAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaign_journey_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "customer_campaign_opt_outs" (
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "optedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_campaign_opt_outs_pkey" PRIMARY KEY ("businessId","customerId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_journeys_businessId_name_key" ON "campaign_journeys"("businessId", "name");
CREATE INDEX IF NOT EXISTS "campaign_journeys_businessId_idx" ON "campaign_journeys"("businessId");
CREATE INDEX IF NOT EXISTS "campaign_journeys_businessId_status_idx" ON "campaign_journeys"("businessId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_journey_steps_journeyId_orderIndex_key" ON "campaign_journey_steps"("journeyId", "orderIndex");
CREATE INDEX IF NOT EXISTS "campaign_journey_steps_journeyId_idx" ON "campaign_journey_steps"("journeyId");

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_journey_enrollments_journeyId_customerId_key" ON "campaign_journey_enrollments"("journeyId", "customerId");
CREATE INDEX IF NOT EXISTS "campaign_journey_enrollments_businessId_status_nextStepAt_idx" ON "campaign_journey_enrollments"("businessId", "status", "nextStepAt");
CREATE INDEX IF NOT EXISTS "campaign_journey_enrollments_customerId_idx" ON "campaign_journey_enrollments"("customerId");

CREATE UNIQUE INDEX IF NOT EXISTS "customer_campaign_opt_outs_customerId_key" ON "customer_campaign_opt_outs"("customerId");
CREATE INDEX IF NOT EXISTS "customer_campaign_opt_outs_businessId_idx" ON "customer_campaign_opt_outs"("businessId");
CREATE INDEX IF NOT EXISTS "campaigns_journeyId_idx" ON "campaigns"("journeyId");

ALTER TABLE "campaign_journeys" ADD CONSTRAINT "campaign_journeys_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_journey_steps" ADD CONSTRAINT "campaign_journey_steps_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "campaign_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_journey_enrollments" ADD CONSTRAINT "campaign_journey_enrollments_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "campaign_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_journey_enrollments" ADD CONSTRAINT "campaign_journey_enrollments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_campaign_opt_outs" ADD CONSTRAINT "customer_campaign_opt_outs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_campaign_opt_outs" ADD CONSTRAINT "customer_campaign_opt_outs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "campaign_journeys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
