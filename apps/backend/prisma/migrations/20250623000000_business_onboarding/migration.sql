-- Extend Industry enum
ALTER TYPE "Industry" ADD VALUE IF NOT EXISTS 'SCHOOL';
ALTER TYPE "Industry" ADD VALUE IF NOT EXISTS 'CONSTRUCTION';
ALTER TYPE "Industry" ADD VALUE IF NOT EXISTS 'ECOMMERCE';
ALTER TYPE "Industry" ADD VALUE IF NOT EXISTS 'RETAIL';
ALTER TYPE "Industry" ADD VALUE IF NOT EXISTS 'LOGISTICS';
ALTER TYPE "Industry" ADD VALUE IF NOT EXISTS 'NGO';
ALTER TYPE "Industry" ADD VALUE IF NOT EXISTS 'GOVERNMENT';

-- Business onboarding fields
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "whatsappNumber" TEXT;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "onboardingStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "onboardingData" JSONB;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "employeeRange" TEXT;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "customerVolume" TEXT;
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "mainGoal" TEXT;

-- Mark existing businesses as onboarded
UPDATE "businesses" SET "onboardingCompletedAt" = "createdAt" WHERE "onboardingCompletedAt" IS NULL;

-- User welcome screen tracking
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "welcomeSeenAt" TIMESTAMP(3);
