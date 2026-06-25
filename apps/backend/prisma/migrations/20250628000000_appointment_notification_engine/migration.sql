-- Appointment reminder engine: notification tracking + new reminder flags

CREATE TYPE "AppointmentNotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'SMS', 'PUSH');
CREATE TYPE "AppointmentNotificationType" AS ENUM (
  'APPOINTMENT_CREATED',
  'APPOINTMENT_APPROVED',
  'REMINDER_30_MIN',
  'REMINDER_20_MIN',
  'REMINDER_10_MIN',
  'MISSED_APPOINTMENT',
  'FOLLOW_UP_24H'
);
CREATE TYPE "AppointmentNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "reminder30mSent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reminder20mSent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reminder10mSent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "followUp24hSent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "missedNotificationSent" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "appointment_notifications" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "channel" "AppointmentNotificationChannel" NOT NULL,
  "notificationType" "AppointmentNotificationType" NOT NULL,
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "status" "AppointmentNotificationStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointment_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "appointment_notifications_appointmentId_notificationType_channel_key"
  ON "appointment_notifications"("appointmentId", "notificationType", "channel");
CREATE INDEX IF NOT EXISTS "appointment_notifications_appointmentId_idx"
  ON "appointment_notifications"("appointmentId");
CREATE INDEX IF NOT EXISTS "appointment_notifications_businessId_status_idx"
  ON "appointment_notifications"("businessId", "status");
CREATE INDEX IF NOT EXISTS "appointment_notifications_scheduledAt_status_idx"
  ON "appointment_notifications"("scheduledAt", "status");

ALTER TABLE "appointment_notifications"
  ADD CONSTRAINT "appointment_notifications_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointment_notifications"
  ADD CONSTRAINT "appointment_notifications_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "appointment_notifications"
  ADD CONSTRAINT "appointment_notifications_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
