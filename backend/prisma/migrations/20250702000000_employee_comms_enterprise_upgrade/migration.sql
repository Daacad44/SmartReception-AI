-- Employee Communication Center enterprise upgrade

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT;

ALTER TABLE "employee_groups" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "employee_groups" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "employee_groups" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "employee_groups" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "employee_groups" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

ALTER TABLE "employee_broadcasts" ADD COLUMN IF NOT EXISTS "groupIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "employee_broadcasts" ADD COLUMN IF NOT EXISTS "roles" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "employee_broadcasts" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "employee_broadcasts" ADD COLUMN IF NOT EXISTS "audienceFilter" JSONB;

CREATE INDEX IF NOT EXISTS "employee_groups_businessId_status_idx" ON "employee_groups"("businessId", "status");

ALTER TABLE "employee_groups" ADD CONSTRAINT "employee_groups_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "employee_import_jobs" (
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
    CONSTRAINT "employee_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "employee_import_jobs_businessId_idx" ON "employee_import_jobs"("businessId");
CREATE INDEX IF NOT EXISTS "employee_import_jobs_businessId_createdAt_idx" ON "employee_import_jobs"("businessId", "createdAt");

ALTER TABLE "employee_import_jobs" ADD CONSTRAINT "employee_import_jobs_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_import_jobs" ADD CONSTRAINT "employee_import_jobs_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
