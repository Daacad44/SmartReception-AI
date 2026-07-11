-- Enterprise appointment scheduling: structured working hours, appointment
-- settings and business exceptions. Also extends the Business Profile with
-- richer identity/location fields. Idempotent so it is safe to re-run.

-- ─── Business Profile: new identity & location columns ───────────────────────
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "targetAudience" TEXT;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "supportEmail" TEXT;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "timezone" TEXT;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

-- ─── Business exception type enum ────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BusinessExceptionType') THEN
    CREATE TYPE "BusinessExceptionType" AS ENUM (
      'NATIONAL_HOLIDAY',
      'RELIGIOUS_HOLIDAY',
      'EMERGENCY_CLOSURE',
      'MAINTENANCE',
      'VACATION',
      'SPECIAL_HOURS',
      'HALF_DAY',
      'TEMPORARY_CLOSURE'
    );
  END IF;
END$$;

-- ─── Appointment settings (1:1 with business) ────────────────────────────────
CREATE TABLE IF NOT EXISTS "appointment_settings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Mogadishu',
    "slotDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
    "minNoticeMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
    "maxDailyBookings" INTEGER,
    "allowSameDay" BOOLEAN NOT NULL DEFAULT true,
    "weeklyHours" JSONB NOT NULL,
    "blockedDates" JSONB,
    "unavailableSlots" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "appointment_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "appointment_settings_businessId_key"
  ON "appointment_settings"("businessId");

-- ─── Business exceptions (holidays / closures / special hours) ────────────────
CREATE TABLE IF NOT EXISTS "business_exceptions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "BusinessExceptionType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "isClosed" BOOLEAN NOT NULL DEFAULT true,
    "openTime" TEXT,
    "closeTime" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "business_exceptions_businessId_idx"
  ON "business_exceptions"("businessId");
CREATE INDEX IF NOT EXISTS "business_exceptions_businessId_startDate_idx"
  ON "business_exceptions"("businessId", "startDate");

-- ─── Foreign keys ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_settings_businessId_fkey'
  ) THEN
    ALTER TABLE "appointment_settings"
      ADD CONSTRAINT "appointment_settings_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "businesses"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'business_exceptions_businessId_fkey'
  ) THEN
    ALTER TABLE "business_exceptions"
      ADD CONSTRAINT "business_exceptions_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "businesses"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
