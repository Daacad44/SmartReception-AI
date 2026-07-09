-- Business application / Super Admin approval workflow.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "UserApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'ACTIVE', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable (existing users are grandfathered to ACTIVE via the column default)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "approvalStatus" "UserApprovalStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "approvalCodeHash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "approvalCodeExpires" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "approvalCodeAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
