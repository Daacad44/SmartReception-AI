-- Enterprise CRM: segments, campaigns, customer/appointment CRM fields

-- New enums
CREATE TYPE "CustomerType" AS ENUM ('VIP', 'REGULAR', 'NEW_CUSTOMER', 'RETURNING', 'HIGH_VALUE', 'INACTIVE', 'LEAD');
CREATE TYPE "AppointmentPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST');
CREATE TYPE "CampaignType" AS ENUM ('PROMOTION', 'OFFER', 'ANNOUNCEMENT', 'REMINDER', 'FOLLOW_UP', 'HOLIDAY', 'MARKETING');
CREATE TYPE "CampaignSchedule" AS ENUM ('ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "CampaignRecipientStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- NotificationType extensions
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CAMPAIGN_DELIVERED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CAMPAIGN_FAILED';

-- Customer CRM fields
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "whatsappNumber" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "companyName" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "customerType" "CustomerType" NOT NULL DEFAULT 'REGULAR';
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "leadStatus" "LeadStatus" NOT NULL DEFAULT 'NEW';
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "customerValue" DECIMAL(12,2);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "aiSummary" JSONB;

CREATE INDEX IF NOT EXISTS "customers_businessId_customerType_idx" ON "customers"("businessId", "customerType");

-- Appointment CRM fields
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "serviceCategory" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "requirementsCollected" JSONB;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "aiConversationSummary" JSONB;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "budget" DECIMAL(12,2);
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "priority" "AppointmentPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

CREATE INDEX IF NOT EXISTS "appointments_createdById_idx" ON "appointments"("createdById");
CREATE INDEX IF NOT EXISTS "appointments_priority_idx" ON "appointments"("priority");

ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_createdById_fkey";
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Customer segments
CREATE TABLE IF NOT EXISTS "customer_segments" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#D97706',
    "customerType" "CustomerType",
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_segments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "customer_segments_businessId_name_key" ON "customer_segments"("businessId", "name");
CREATE INDEX IF NOT EXISTS "customer_segments_businessId_idx" ON "customer_segments"("businessId");

ALTER TABLE "customer_segments" DROP CONSTRAINT IF EXISTS "customer_segments_businessId_fkey";
ALTER TABLE "customer_segments" ADD CONSTRAINT "customer_segments_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "customer_segment_members" (
    "segmentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_segment_members_pkey" PRIMARY KEY ("segmentId","customerId")
);

CREATE INDEX IF NOT EXISTS "customer_segment_members_customerId_idx" ON "customer_segment_members"("customerId");

ALTER TABLE "customer_segment_members" DROP CONSTRAINT IF EXISTS "customer_segment_members_segmentId_fkey";
ALTER TABLE "customer_segment_members" ADD CONSTRAINT "customer_segment_members_segmentId_fkey"
  FOREIGN KEY ("segmentId") REFERENCES "customer_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_segment_members" DROP CONSTRAINT IF EXISTS "customer_segment_members_customerId_fkey";
ALTER TABLE "customer_segment_members" ADD CONSTRAINT "customer_segment_members_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Campaigns
CREATE TABLE IF NOT EXISTS "campaigns" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "CampaignType" NOT NULL DEFAULT 'MARKETING',
    "schedule" "CampaignSchedule" NOT NULL DEFAULT 'ONE_TIME',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "segmentId" TEXT,
    "customerTypes" "CustomerType"[] DEFAULT ARRAY[]::"CustomerType"[],
    "scheduledAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "createdById" TEXT,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "campaigns_businessId_idx" ON "campaigns"("businessId");
CREATE INDEX IF NOT EXISTS "campaigns_businessId_status_idx" ON "campaigns"("businessId", "status");
CREATE INDEX IF NOT EXISTS "campaigns_scheduledAt_idx" ON "campaigns"("scheduledAt");
CREATE INDEX IF NOT EXISTS "campaigns_nextRunAt_idx" ON "campaigns"("nextRunAt");

ALTER TABLE "campaigns" DROP CONSTRAINT IF EXISTS "campaigns_businessId_fkey";
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "campaigns" DROP CONSTRAINT IF EXISTS "campaigns_segmentId_fkey";
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_segmentId_fkey"
  FOREIGN KEY ("segmentId") REFERENCES "customer_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "campaigns" DROP CONSTRAINT IF EXISTS "campaigns_createdById_fkey";
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "campaign_recipients" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "CampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "whatsappMsgId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_recipients_campaignId_customerId_key" ON "campaign_recipients"("campaignId", "customerId");
CREATE INDEX IF NOT EXISTS "campaign_recipients_campaignId_idx" ON "campaign_recipients"("campaignId");
CREATE INDEX IF NOT EXISTS "campaign_recipients_customerId_idx" ON "campaign_recipients"("customerId");
CREATE INDEX IF NOT EXISTS "campaign_recipients_status_idx" ON "campaign_recipients"("status");

ALTER TABLE "campaign_recipients" DROP CONSTRAINT IF EXISTS "campaign_recipients_campaignId_fkey";
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "campaign_recipients" DROP CONSTRAINT IF EXISTS "campaign_recipients_customerId_fkey";
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
