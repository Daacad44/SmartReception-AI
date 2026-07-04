-- Enterprise Subscription & License Management

CREATE TYPE "BusinessLicenseStatus" AS ENUM ('PENDING', 'TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "SubscriptionDurationPreset" AS ENUM ('DAYS_30', 'DAYS_90', 'DAYS_180', 'DAYS_365', 'CUSTOM');
CREATE TYPE "SubscriptionActivityAction" AS ENUM ('ASSIGNED', 'EXTENDED', 'SHORTENED', 'PAUSED', 'RESUMED', 'SUSPENDED', 'REACTIVATED', 'EXPIRED', 'UNLOCKED', 'RENEWED', 'CANCELLED', 'UPGRADED', 'DOWNGRADED', 'NOTE_ADDED');
CREATE TYPE "SubscriptionNotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'SMS', 'PUSH');
CREATE TYPE "SubscriptionNotificationType" AS ENUM ('REMINDER_7D', 'REMINDER_3D', 'REMINDER_2D', 'REMINDER_1D', 'REMINDER_12H', 'REMINDER_6H', 'REMINDER_1H', 'EXPIRED', 'ACTIVATED', 'SUSPENDED', 'RENEWED');
CREATE TYPE "SubscriptionNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "SubscriptionPaymentStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'PAID', 'FAILED', 'REFUNDED');

ALTER TABLE "businesses" ADD COLUMN "licenseStatus" "BusinessLicenseStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "businesses" ADD COLUMN "isLicenseLocked" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "code" "SubscriptionPlan" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "features" JSONB,
    "monthlyPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "yearlyPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");

CREATE TABLE "business_subscriptions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "BusinessLicenseStatus" NOT NULL DEFAULT 'PENDING',
    "durationPreset" "SubscriptionDurationPreset",
    "durationDays" INTEGER,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "internalNotes" TEXT,
    "paymentStatus" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_subscriptions_businessId_key" ON "business_subscriptions"("businessId");
CREATE INDEX "business_subscriptions_status_idx" ON "business_subscriptions"("status");
CREATE INDEX "business_subscriptions_expiresAt_idx" ON "business_subscriptions"("expiresAt");
CREATE INDEX "business_subscriptions_planId_idx" ON "business_subscriptions"("planId");

CREATE TABLE "subscription_history" (
    "id" TEXT NOT NULL,
    "businessSubscriptionId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "planId" TEXT,
    "status" "BusinessLicenseStatus" NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "action" "SubscriptionActivityAction" NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subscription_history_businessId_idx" ON "subscription_history"("businessId");
CREATE INDEX "subscription_history_businessSubscriptionId_idx" ON "subscription_history"("businessSubscriptionId");
CREATE INDEX "subscription_history_createdAt_idx" ON "subscription_history"("createdAt");

CREATE TABLE "subscription_notifications" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "businessSubscriptionId" TEXT NOT NULL,
    "channel" "SubscriptionNotificationChannel" NOT NULL,
    "type" "SubscriptionNotificationType" NOT NULL,
    "status" "SubscriptionNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "message" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subscription_notifications_businessId_idx" ON "subscription_notifications"("businessId");
CREATE INDEX "subscription_notifications_businessSubscriptionId_idx" ON "subscription_notifications"("businessSubscriptionId");
CREATE INDEX "subscription_notifications_scheduledFor_idx" ON "subscription_notifications"("scheduledFor");
CREATE INDEX "subscription_notifications_status_idx" ON "subscription_notifications"("status");

CREATE TABLE "subscription_activity_logs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "businessSubscriptionId" TEXT,
    "action" "SubscriptionActivityAction" NOT NULL,
    "performedById" TEXT,
    "performedByEmail" TEXT,
    "ipAddress" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subscription_activity_logs_businessId_idx" ON "subscription_activity_logs"("businessId");
CREATE INDEX "subscription_activity_logs_action_idx" ON "subscription_activity_logs"("action");
CREATE INDEX "subscription_activity_logs_createdAt_idx" ON "subscription_activity_logs"("createdAt");

ALTER TABLE "business_subscriptions" ADD CONSTRAINT "business_subscriptions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_subscriptions" ADD CONSTRAINT "business_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_subscriptions" ADD CONSTRAINT "business_subscriptions_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_businessSubscriptionId_fkey" FOREIGN KEY ("businessSubscriptionId") REFERENCES "business_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "subscription_notifications" ADD CONSTRAINT "subscription_notifications_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_notifications" ADD CONSTRAINT "subscription_notifications_businessSubscriptionId_fkey" FOREIGN KEY ("businessSubscriptionId") REFERENCES "business_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_activity_logs" ADD CONSTRAINT "subscription_activity_logs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_activity_logs" ADD CONSTRAINT "subscription_activity_logs_businessSubscriptionId_fkey" FOREIGN KEY ("businessSubscriptionId") REFERENCES "business_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "subscription_activity_logs" ADD CONSTRAINT "subscription_activity_logs_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "businesses_licenseStatus_idx" ON "businesses"("licenseStatus");

-- Seed subscription plans
INSERT INTO "subscription_plans" ("id", "code", "name", "description", "monthlyPrice", "yearlyPrice", "sortOrder", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'FREE', 'Free', 'Trial / limited access', 0, 0, 0, NOW()),
  (gen_random_uuid()::text, 'STARTER', 'Starter', 'Small businesses', 29, 290, 1, NOW()),
  (gen_random_uuid()::text, 'BUSINESS', 'Business', 'Growing teams', 79, 790, 2, NOW()),
  (gen_random_uuid()::text, 'PROFESSIONAL', 'Professional', 'Advanced features', 99, 990, 3, NOW()),
  (gen_random_uuid()::text, 'ENTERPRISE', 'Enterprise', 'Full platform access', 299, 2990, 4, NOW())
ON CONFLICT ("code") DO NOTHING;

-- Migrate existing subscriptions into business_subscriptions
INSERT INTO "business_subscriptions" (
  "id", "businessId", "planId", "status", "durationDays", "activatedAt", "expiresAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  s."businessId",
  sp."id",
  CASE
    WHEN s."status" = 'EXPIRED' THEN 'EXPIRED'::"BusinessLicenseStatus"
    WHEN s."status" = 'CANCELLED' THEN 'CANCELLED'::"BusinessLicenseStatus"
    WHEN s."status" = 'TRIALING' THEN 'TRIAL'::"BusinessLicenseStatus"
    ELSE 'ACTIVE'::"BusinessLicenseStatus"
  END,
  GREATEST(1, COALESCE(EXTRACT(DAY FROM (s."currentPeriodEnd" - s."currentPeriodStart"))::int, 30)),
  COALESCE(s."currentPeriodStart", s."createdAt"),
  COALESCE(s."currentPeriodEnd", s."createdAt" + interval '14 days'),
  NOW()
FROM "subscriptions" s
JOIN "subscription_plans" sp ON sp."code" = s."plan"
WHERE NOT EXISTS (
  SELECT 1 FROM "business_subscriptions" bs WHERE bs."businessId" = s."businessId"
);

UPDATE "businesses" b
SET
  "licenseStatus" = bs."status",
  "isLicenseLocked" = (bs."status" IN ('EXPIRED', 'SUSPENDED', 'CANCELLED'))
FROM "business_subscriptions" bs
WHERE bs."businessId" = b."id";
