-- Extend appointment lifecycle statuses
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'RESCHEDULED';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'CUSTOMER_ARRIVED';

-- Extend notification types
ALTER TYPE "AppointmentNotificationType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_CONFIRMED';
ALTER TYPE "AppointmentNotificationType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_PENDING';
ALTER TYPE "AppointmentNotificationType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_RESCHEDULED';
ALTER TYPE "AppointmentNotificationType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_CANCELLED';
ALTER TYPE "AppointmentNotificationType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_REJECTED';
ALTER TYPE "AppointmentNotificationType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_IN_PROGRESS';
ALTER TYPE "AppointmentNotificationType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_COMPLETED';
ALTER TYPE "AppointmentNotificationType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_EXPIRED';
ALTER TYPE "AppointmentNotificationType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_NO_SHOW';
ALTER TYPE "AppointmentNotificationType" ADD VALUE IF NOT EXISTS 'REMINDER_24_HOURS';
ALTER TYPE "AppointmentNotificationType" ADD VALUE IF NOT EXISTS 'REMINDER_12_HOURS';
ALTER TYPE "AppointmentNotificationType" ADD VALUE IF NOT EXISTS 'REMINDER_6_HOURS';
ALTER TYPE "AppointmentNotificationType" ADD VALUE IF NOT EXISTS 'REMINDER_1_HOUR';
ALTER TYPE "AppointmentNotificationType" ADD VALUE IF NOT EXISTS 'REMINDER_15_MINUTES';

-- Extend notification delivery statuses
ALTER TYPE "AppointmentNotificationStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "AppointmentNotificationStatus" ADD VALUE IF NOT EXISTS 'READ';
ALTER TYPE "AppointmentNotificationStatus" ADD VALUE IF NOT EXISTS 'BOUNCED';

-- Expand appointment_notifications for per-recipient delivery tracking
ALTER TABLE "appointment_notifications" ADD COLUMN IF NOT EXISTS "recipient" TEXT NOT NULL DEFAULT '';
ALTER TABLE "appointment_notifications" ADD COLUMN IF NOT EXISTS "templateKey" TEXT;
ALTER TABLE "appointment_notifications" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "appointment_notifications" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);
ALTER TABLE "appointment_notifications" ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);
ALTER TABLE "appointment_notifications" ADD COLUMN IF NOT EXISTS "externalMessageId" TEXT;
ALTER TABLE "appointment_notifications" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "appointment_notifications" ADD COLUMN IF NOT EXISTS "maxRetries" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "appointment_notifications" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP INDEX IF EXISTS "appointment_notifications_appointmentId_notificationType_channel_key";
CREATE UNIQUE INDEX IF NOT EXISTS "appointment_notifications_appointmentId_notificationType_channel_recipient_key"
  ON "appointment_notifications"("appointmentId", "notificationType", "channel", "recipient");

CREATE INDEX IF NOT EXISTS "appointment_notifications_status_retryCount_idx"
  ON "appointment_notifications"("status", "retryCount");

-- Business-customizable appointment message templates
CREATE TABLE IF NOT EXISTS "appointment_message_templates" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "channel" "AppointmentNotificationChannel",
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_message_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "appointment_message_templates_businessId_templateKey_channel_key"
  ON "appointment_message_templates"("businessId", "templateKey", "channel");

CREATE INDEX IF NOT EXISTS "appointment_message_templates_businessId_isActive_idx"
  ON "appointment_message_templates"("businessId", "isActive");

ALTER TABLE "appointment_message_templates" ADD CONSTRAINT "appointment_message_templates_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
