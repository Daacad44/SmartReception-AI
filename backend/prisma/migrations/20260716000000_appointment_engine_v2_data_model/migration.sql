-- Appointment Engine v2: persisted slots, waitlist, generic notification
-- queue, and AI booking decision log. Extends the existing appointment
-- scheduling engine (AppointmentSettings / BusinessException) rather than
-- replacing it. Idempotent / guarded so it is safe to re-run.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AppointmentSlotStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'FULL', 'BLOCKED', 'HELD');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'NOTIFIED', 'BOOKED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationQueueChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "NotificationQueueStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- AlterTable: buffer between bookings, per service
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "bufferMinutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: link an appointment back to the materialized slot it booked
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "slotId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "appointment_slots" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "serviceId" TEXT,
    "date" DATE NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentSlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "heldUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "waitlist_entries" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerPhone" TEXT NOT NULL,
    "serviceId" TEXT,
    "preferredDate" DATE,
    "preferredTime" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "notifiedAt" TIMESTAMP(3),
    "heldSlotId" TEXT,
    "bookedAppointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_queue" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "channel" "NotificationQueueChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationQueueStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "errorMessage" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ai_booking_logs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT,
    "conversationId" TEXT,
    "intent" TEXT NOT NULL,
    "selectedSlotId" TEXT,
    "slotsCheckedCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCheckResult" TEXT,
    "source" TEXT NOT NULL DEFAULT 'WHATSAPP_AI',
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_booking_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointment_slots_businessId_date_idx" ON "appointment_slots"("businessId", "date");
CREATE INDEX IF NOT EXISTS "appointment_slots_businessId_status_idx" ON "appointment_slots"("businessId", "status");
CREATE INDEX IF NOT EXISTS "appointment_slots_businessId_serviceId_date_idx" ON "appointment_slots"("businessId", "serviceId", "date");
CREATE INDEX IF NOT EXISTS "appointment_slots_heldUntil_idx" ON "appointment_slots"("heldUntil");
CREATE UNIQUE INDEX IF NOT EXISTS "appointment_slots_businessId_serviceId_startTime_key" ON "appointment_slots"("businessId", "serviceId", "startTime");

CREATE INDEX IF NOT EXISTS "waitlist_entries_businessId_status_idx" ON "waitlist_entries"("businessId", "status");
CREATE INDEX IF NOT EXISTS "waitlist_entries_businessId_serviceId_status_idx" ON "waitlist_entries"("businessId", "serviceId", "status");
CREATE INDEX IF NOT EXISTS "waitlist_entries_businessId_priority_createdAt_idx" ON "waitlist_entries"("businessId", "priority", "createdAt");

CREATE INDEX IF NOT EXISTS "notification_queue_businessId_status_idx" ON "notification_queue"("businessId", "status");
CREATE INDEX IF NOT EXISTS "notification_queue_scheduledFor_status_idx" ON "notification_queue"("scheduledFor", "status");
CREATE INDEX IF NOT EXISTS "notification_queue_status_retryCount_idx" ON "notification_queue"("status", "retryCount");
CREATE INDEX IF NOT EXISTS "notification_queue_relatedType_relatedId_idx" ON "notification_queue"("relatedType", "relatedId");

CREATE INDEX IF NOT EXISTS "ai_booking_logs_businessId_createdAt_idx" ON "ai_booking_logs"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_booking_logs_businessId_intent_idx" ON "ai_booking_logs"("businessId", "intent");

CREATE INDEX IF NOT EXISTS "appointments_slotId_idx" ON "appointments"("slotId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "appointments" ADD CONSTRAINT "appointments_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "appointment_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "appointment_slots" ADD CONSTRAINT "appointment_slots_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "appointment_slots" ADD CONSTRAINT "appointment_slots_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ai_booking_logs" ADD CONSTRAINT "ai_booking_logs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ai_booking_logs" ADD CONSTRAINT "ai_booking_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
