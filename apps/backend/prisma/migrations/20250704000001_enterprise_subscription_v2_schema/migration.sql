-- Enterprise Subscription V2 (part 2) — schema, plans, payment tables

ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "featureFlags" JSONB;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "maxUsers" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "maxConversations" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "maxWhatsappNumbers" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "maxAiAgents" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "storageLimitMb" INTEGER NOT NULL DEFAULT 512;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "knowledgeBaseLimit" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "teamLimit" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "campaignLimit" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "subscription_plans" ADD COLUMN IF NOT EXISTS "appointmentLimit" INTEGER NOT NULL DEFAULT 50;

ALTER TABLE "business_subscriptions" ADD COLUMN IF NOT EXISTS "previousPlanId" TEXT;
ALTER TABLE "business_subscriptions" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
ALTER TABLE "business_subscriptions" ADD COLUMN IF NOT EXISTS "isTrial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "business_subscriptions" ADD COLUMN IF NOT EXISTS "paymentMethod" "SubscriptionPaymentMethod";
ALTER TABLE "business_subscriptions" ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;
ALTER TABLE "business_subscriptions" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE "business_subscriptions" ADD COLUMN IF NOT EXISTS "lastPaymentAt" TIMESTAMP(3);
ALTER TABLE "business_subscriptions" ADD COLUMN IF NOT EXISTS "nextRenewalAt" TIMESTAMP(3);

UPDATE "subscription_plans" SET
  "maxUsers" = 1, "maxConversations" = 100, "maxWhatsappNumbers" = 1, "maxAiAgents" = 1,
  "storageLimitMb" = 256, "knowledgeBaseLimit" = 1, "teamLimit" = 1, "campaignLimit" = 0, "appointmentLimit" = 25,
  "featureFlags" = '{"aiChat":true,"knowledgeBase":false,"appointments":true,"broadcast":false,"crm":true,"campaigns":false,"analytics":false,"apiAccess":false,"webhookAccess":false,"multiBusiness":false,"whiteLabel":false}'::jsonb,
  "updatedAt" = NOW()
WHERE "code" = 'FREE';

UPDATE "subscription_plans" SET
  "name" = 'Starter', "maxUsers" = 3, "maxConversations" = 1000, "maxWhatsappNumbers" = 1, "maxAiAgents" = 1,
  "storageLimitMb" = 1024, "knowledgeBaseLimit" = 2, "teamLimit" = 3, "campaignLimit" = 2, "appointmentLimit" = 100,
  "monthlyPrice" = 29, "yearlyPrice" = 290,
  "featureFlags" = '{"aiChat":true,"knowledgeBase":true,"appointments":true,"broadcast":false,"crm":true,"campaigns":true,"analytics":true,"apiAccess":false,"webhookAccess":false,"multiBusiness":false,"whiteLabel":false}'::jsonb,
  "updatedAt" = NOW()
WHERE "code" = 'STARTER';

UPDATE "subscription_plans" SET
  "name" = 'Professional', "maxUsers" = 10, "maxConversations" = 5000, "maxWhatsappNumbers" = 2, "maxAiAgents" = 3,
  "storageLimitMb" = 5120, "knowledgeBaseLimit" = 5, "teamLimit" = 10, "campaignLimit" = 10, "appointmentLimit" = 500,
  "monthlyPrice" = 99, "yearlyPrice" = 990,
  "featureFlags" = '{"aiChat":true,"knowledgeBase":true,"appointments":true,"broadcast":true,"crm":true,"campaigns":true,"analytics":true,"apiAccess":true,"webhookAccess":true,"multiBusiness":false,"whiteLabel":false}'::jsonb,
  "updatedAt" = NOW()
WHERE "code" = 'PROFESSIONAL';

UPDATE "subscription_plans" SET
  "name" = 'Business', "maxUsers" = 5, "maxConversations" = 3000, "maxWhatsappNumbers" = 2, "maxAiAgents" = 2,
  "storageLimitMb" = 3072, "knowledgeBaseLimit" = 3, "teamLimit" = 5, "campaignLimit" = 5, "appointmentLimit" = 300,
  "monthlyPrice" = 79, "yearlyPrice" = 790,
  "featureFlags" = '{"aiChat":true,"knowledgeBase":true,"appointments":true,"broadcast":true,"crm":true,"campaigns":true,"analytics":true,"apiAccess":false,"webhookAccess":true,"multiBusiness":false,"whiteLabel":false}'::jsonb,
  "updatedAt" = NOW()
WHERE "code" = 'BUSINESS';

UPDATE "subscription_plans" SET
  "name" = 'Enterprise', "maxUsers" = 100, "maxConversations" = 50000, "maxWhatsappNumbers" = 10, "maxAiAgents" = 20,
  "storageLimitMb" = 51200, "knowledgeBaseLimit" = 50, "teamLimit" = 100, "campaignLimit" = 100, "appointmentLimit" = 10000,
  "monthlyPrice" = 299, "yearlyPrice" = 2990,
  "featureFlags" = '{"aiChat":true,"knowledgeBase":true,"appointments":true,"broadcast":true,"crm":true,"campaigns":true,"analytics":true,"apiAccess":true,"webhookAccess":true,"multiBusiness":true,"whiteLabel":true}'::jsonb,
  "updatedAt" = NOW()
WHERE "code" = 'ENTERPRISE';

INSERT INTO "subscription_plans" (
  "id", "code", "name", "description", "monthlyPrice", "yearlyPrice", "sortOrder",
  "maxUsers", "maxConversations", "maxWhatsappNumbers", "maxAiAgents", "storageLimitMb",
  "knowledgeBaseLimit", "teamLimit", "campaignLimit", "appointmentLimit", "featureFlags", "updatedAt"
)
VALUES (
  gen_random_uuid()::text, 'CUSTOM', 'Custom', 'Tailored enterprise plan', 0, 0, 5,
  999, 999999, 50, 50, 102400, 100, 200, 500, 50000,
  '{"aiChat":true,"knowledgeBase":true,"appointments":true,"broadcast":true,"crm":true,"campaigns":true,"analytics":true,"apiAccess":true,"webhookAccess":true,"multiBusiness":true,"whiteLabel":true}'::jsonb,
  NOW()
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "featureFlags" = EXCLUDED."featureFlags",
  "maxUsers" = EXCLUDED."maxUsers",
  "maxConversations" = EXCLUDED."maxConversations",
  "updatedAt" = NOW();

CREATE TABLE IF NOT EXISTS "subscription_payments" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "businessSubscriptionId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "SubscriptionPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paymentMethod" "SubscriptionPaymentMethod",
  "referenceNumber" TEXT,
  "invoiceNumber" TEXT,
  "provider" TEXT,
  "providerRef" TEXT,
  "paidAt" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB,
  "recordedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "subscription_transactions" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "paymentId" TEXT,
  "type" "SubscriptionTransactionType" NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "provider" TEXT,
  "providerRef" TEXT,
  "status" "SubscriptionTransactionStatus" NOT NULL DEFAULT 'PENDING',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "subscription_renewals" (
  "id" TEXT NOT NULL,
  "businessSubscriptionId" TEXT NOT NULL,
  "paymentId" TEXT,
  "previousExpiresAt" TIMESTAMP(3),
  "newExpiresAt" TIMESTAMP(3) NOT NULL,
  "renewedById" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_renewals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "subscription_coupons" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT,
  "discountType" "SubscriptionDiscountType" NOT NULL,
  "discountValue" DECIMAL(10,2) NOT NULL,
  "maxUses" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscription_coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_coupons_code_key" ON "subscription_coupons"("code");

CREATE TABLE IF NOT EXISTS "subscription_discounts" (
  "id" TEXT NOT NULL,
  "businessSubscriptionId" TEXT NOT NULL,
  "couponId" TEXT,
  "discountType" "SubscriptionDiscountType" NOT NULL,
  "discountValue" DECIMAL(10,2) NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedById" TEXT,
  CONSTRAINT "subscription_discounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "subscription_payments_businessId_idx" ON "subscription_payments"("businessId");
CREATE INDEX IF NOT EXISTS "subscription_payments_businessSubscriptionId_idx" ON "subscription_payments"("businessSubscriptionId");
CREATE INDEX IF NOT EXISTS "subscription_transactions_businessId_idx" ON "subscription_transactions"("businessId");
CREATE INDEX IF NOT EXISTS "subscription_renewals_businessSubscriptionId_idx" ON "subscription_renewals"("businessSubscriptionId");
CREATE INDEX IF NOT EXISTS "subscription_discounts_businessSubscriptionId_idx" ON "subscription_discounts"("businessSubscriptionId");

ALTER TABLE "subscription_payments" DROP CONSTRAINT IF EXISTS "subscription_payments_businessId_fkey";
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE;
ALTER TABLE "subscription_payments" DROP CONSTRAINT IF EXISTS "subscription_payments_businessSubscriptionId_fkey";
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_businessSubscriptionId_fkey" FOREIGN KEY ("businessSubscriptionId") REFERENCES "business_subscriptions"("id") ON DELETE CASCADE;
ALTER TABLE "subscription_payments" DROP CONSTRAINT IF EXISTS "subscription_payments_recordedById_fkey";
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "subscription_transactions" DROP CONSTRAINT IF EXISTS "subscription_transactions_businessId_fkey";
ALTER TABLE "subscription_transactions" ADD CONSTRAINT "subscription_transactions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE;
ALTER TABLE "subscription_transactions" DROP CONSTRAINT IF EXISTS "subscription_transactions_paymentId_fkey";
ALTER TABLE "subscription_transactions" ADD CONSTRAINT "subscription_transactions_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "subscription_payments"("id") ON DELETE SET NULL;

ALTER TABLE "subscription_renewals" DROP CONSTRAINT IF EXISTS "subscription_renewals_businessSubscriptionId_fkey";
ALTER TABLE "subscription_renewals" ADD CONSTRAINT "subscription_renewals_businessSubscriptionId_fkey" FOREIGN KEY ("businessSubscriptionId") REFERENCES "business_subscriptions"("id") ON DELETE CASCADE;
ALTER TABLE "subscription_renewals" DROP CONSTRAINT IF EXISTS "subscription_renewals_paymentId_fkey";
ALTER TABLE "subscription_renewals" ADD CONSTRAINT "subscription_renewals_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "subscription_payments"("id") ON DELETE SET NULL;
ALTER TABLE "subscription_renewals" DROP CONSTRAINT IF EXISTS "subscription_renewals_renewedById_fkey";
ALTER TABLE "subscription_renewals" ADD CONSTRAINT "subscription_renewals_renewedById_fkey" FOREIGN KEY ("renewedById") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "subscription_discounts" DROP CONSTRAINT IF EXISTS "subscription_discounts_businessSubscriptionId_fkey";
ALTER TABLE "subscription_discounts" ADD CONSTRAINT "subscription_discounts_businessSubscriptionId_fkey" FOREIGN KEY ("businessSubscriptionId") REFERENCES "business_subscriptions"("id") ON DELETE CASCADE;
ALTER TABLE "subscription_discounts" DROP CONSTRAINT IF EXISTS "subscription_discounts_couponId_fkey";
ALTER TABLE "subscription_discounts" ADD CONSTRAINT "subscription_discounts_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "subscription_coupons"("id") ON DELETE SET NULL;
ALTER TABLE "subscription_discounts" DROP CONSTRAINT IF EXISTS "subscription_discounts_appliedById_fkey";
ALTER TABLE "subscription_discounts" ADD CONSTRAINT "subscription_discounts_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "users"("id") ON DELETE SET NULL;
