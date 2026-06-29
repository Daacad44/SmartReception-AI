-- CreateEnum
CREATE TYPE "PlatformFeatureStatus" AS ENUM ('DISABLED', 'ENABLED', 'HIDDEN', 'INTERNAL', 'BETA', 'COMING_SOON', 'EXPERIMENTAL', 'DEPRECATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PlatformFeatureVisibility" AS ENUM ('PUBLIC', 'INTERNAL', 'SUPER_ADMIN', 'HIDDEN');

-- CreateEnum
CREATE TYPE "PlatformFeatureReleaseType" AS ENUM ('STANDARD', 'BETA', 'PREMIUM', 'EXPERIMENTAL', 'FUTURE', 'INTERNAL');

-- CreateEnum
CREATE TYPE "PlatformFeatureScope" AS ENUM ('PLATFORM_WIDE', 'BUSINESS_SPECIFIC');

-- CreateEnum
CREATE TYPE "PlatformFeatureVerificationAction" AS ENUM ('ENABLE', 'DISABLE', 'STATUS_CHANGE', 'MOVE_FROM_FUTURE');

-- CreateEnum
CREATE TYPE "PlatformFeatureVerificationStatus" AS ENUM ('PENDING_OTP', 'VERIFIED', 'EXPIRED', 'FAILED', 'CANCELLED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "PlatformFeatureAuditAction" AS ENUM ('FEATURE_CREATED', 'FEATURE_UPDATED', 'ACTIVATION_REQUESTED', 'ACTIVATION_VERIFIED', 'ACTIVATION_FAILED', 'DEACTIVATION_REQUESTED', 'DEACTIVATION_VERIFIED', 'STATUS_CHANGED', 'DEPENDENCY_ADDED', 'DEPENDENCY_REMOVED', 'MOVED_FROM_FUTURE', 'NOTES_UPDATED');

-- CreateTable
CREATE TABLE "platform_features" (
    "id" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "module" TEXT NOT NULL,
    "status" "PlatformFeatureStatus" NOT NULL DEFAULT 'DISABLED',
    "visibility" "PlatformFeatureVisibility" NOT NULL DEFAULT 'PUBLIC',
    "releaseType" "PlatformFeatureReleaseType" NOT NULL DEFAULT 'STANDARD',
    "scope" "PlatformFeatureScope" NOT NULL DEFAULT 'PLATFORM_WIDE',
    "routePath" TEXT,
    "apiPrefix" TEXT,
    "navLabel" TEXT,
    "isNavItem" BOOLEAN NOT NULL DEFAULT false,
    "blocksAi" BOOLEAN NOT NULL DEFAULT false,
    "blocksJobs" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "activationDate" TIMESTAMP(3),
    "deactivationDate" TIMESTAMP(3),
    "createdById" TEXT,
    "lastModifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_feature_dependencies" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "dependsOnFeatureId" TEXT NOT NULL,

    CONSTRAINT "platform_feature_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_feature_business_scopes" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" "PlatformFeatureStatus" NOT NULL DEFAULT 'DISABLED',
    "enabledAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_feature_business_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_feature_verification_requests" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "PlatformFeatureVerificationAction" NOT NULL,
    "targetStatus" "PlatformFeatureStatus" NOT NULL,
    "previousStatus" "PlatformFeatureStatus" NOT NULL,
    "reason" TEXT,
    "otpHash" TEXT NOT NULL,
    "otpExpiresAt" TIMESTAMP(3) NOT NULL,
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "status" "PlatformFeatureVerificationStatus" NOT NULL DEFAULT 'PENDING_OTP',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "browser" TEXT,
    "operatingSystem" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_feature_verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_feature_audit_logs" (
    "id" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "featureName" TEXT NOT NULL,
    "businessId" TEXT,
    "action" "PlatformFeatureAuditAction" NOT NULL,
    "previousStatus" "PlatformFeatureStatus",
    "newStatus" "PlatformFeatureStatus",
    "superAdminId" TEXT,
    "verificationStatus" TEXT,
    "verificationCodeId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "browser" TEXT,
    "operatingSystem" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_feature_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_features_featureKey_key" ON "platform_features"("featureKey");

-- CreateIndex
CREATE INDEX "platform_features_category_idx" ON "platform_features"("category");

-- CreateIndex
CREATE INDEX "platform_features_status_idx" ON "platform_features"("status");

-- CreateIndex
CREATE INDEX "platform_features_releaseType_idx" ON "platform_features"("releaseType");

-- CreateIndex
CREATE INDEX "platform_features_module_idx" ON "platform_features"("module");

-- CreateIndex
CREATE UNIQUE INDEX "platform_feature_dependencies_featureId_dependsOnFeatureId_key" ON "platform_feature_dependencies"("featureId", "dependsOnFeatureId");

-- CreateIndex
CREATE INDEX "platform_feature_dependencies_dependsOnFeatureId_idx" ON "platform_feature_dependencies"("dependsOnFeatureId");

-- CreateIndex
CREATE UNIQUE INDEX "platform_feature_business_scopes_featureId_businessId_key" ON "platform_feature_business_scopes"("featureId", "businessId");

-- CreateIndex
CREATE INDEX "platform_feature_business_scopes_businessId_idx" ON "platform_feature_business_scopes"("businessId");

-- CreateIndex
CREATE INDEX "platform_feature_verification_requests_featureId_idx" ON "platform_feature_verification_requests"("featureId");

-- CreateIndex
CREATE INDEX "platform_feature_verification_requests_userId_idx" ON "platform_feature_verification_requests"("userId");

-- CreateIndex
CREATE INDEX "platform_feature_verification_requests_status_idx" ON "platform_feature_verification_requests"("status");

-- CreateIndex
CREATE INDEX "platform_feature_verification_requests_createdAt_idx" ON "platform_feature_verification_requests"("createdAt");

-- CreateIndex
CREATE INDEX "platform_feature_audit_logs_featureId_idx" ON "platform_feature_audit_logs"("featureId");

-- CreateIndex
CREATE INDEX "platform_feature_audit_logs_featureKey_idx" ON "platform_feature_audit_logs"("featureKey");

-- CreateIndex
CREATE INDEX "platform_feature_audit_logs_superAdminId_idx" ON "platform_feature_audit_logs"("superAdminId");

-- CreateIndex
CREATE INDEX "platform_feature_audit_logs_action_idx" ON "platform_feature_audit_logs"("action");

-- CreateIndex
CREATE INDEX "platform_feature_audit_logs_createdAt_idx" ON "platform_feature_audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "platform_features" ADD CONSTRAINT "platform_features_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_features" ADD CONSTRAINT "platform_features_lastModifiedById_fkey" FOREIGN KEY ("lastModifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_feature_dependencies" ADD CONSTRAINT "platform_feature_dependencies_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "platform_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_feature_dependencies" ADD CONSTRAINT "platform_feature_dependencies_dependsOnFeatureId_fkey" FOREIGN KEY ("dependsOnFeatureId") REFERENCES "platform_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_feature_business_scopes" ADD CONSTRAINT "platform_feature_business_scopes_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "platform_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_feature_business_scopes" ADD CONSTRAINT "platform_feature_business_scopes_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_feature_verification_requests" ADD CONSTRAINT "platform_feature_verification_requests_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "platform_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_feature_verification_requests" ADD CONSTRAINT "platform_feature_verification_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_feature_audit_logs" ADD CONSTRAINT "platform_feature_audit_logs_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "platform_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_feature_audit_logs" ADD CONSTRAINT "platform_feature_audit_logs_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_feature_audit_logs" ADD CONSTRAINT "platform_feature_audit_logs_verificationCodeId_fkey" FOREIGN KEY ("verificationCodeId") REFERENCES "platform_feature_verification_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_feature_audit_logs" ADD CONSTRAINT "platform_feature_audit_logs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
