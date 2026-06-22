-- Enterprise upgrade: appointments, 2FA, roles, super admin

-- AlterEnum UserRole
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'RECEPTIONIST';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'STAFF';

-- AlterEnum AppointmentStatus
ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'MISSED';

-- AlterEnum NotificationType
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MISSED_APPOINTMENT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_CUSTOMER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'AI_ESCALATION';

-- AlterTable users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpBackupCodes" TEXT;

-- AlterTable appointments
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "serviceRequested" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "companyName" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "additionalNotes" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "leadSource" TEXT DEFAULT 'WHATSAPP';
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "meetingLink" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "reminder24hSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "reminder1hSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "reminder15mSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "confirmationSentAt" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "missedAt" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "canRebookAfter" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "appointments_assignedToId_idx" ON "appointments"("assignedToId");

ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_assignedToId_fkey";
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable appointment_internal_notes
CREATE TABLE IF NOT EXISTS "appointment_internal_notes" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appointment_internal_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "appointment_internal_notes_appointmentId_idx" ON "appointment_internal_notes"("appointmentId");

ALTER TABLE "appointment_internal_notes" DROP CONSTRAINT IF EXISTS "appointment_internal_notes_appointmentId_fkey";
ALTER TABLE "appointment_internal_notes" ADD CONSTRAINT "appointment_internal_notes_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointment_internal_notes" DROP CONSTRAINT IF EXISTS "appointment_internal_notes_createdById_fkey";
ALTER TABLE "appointment_internal_notes" ADD CONSTRAINT "appointment_internal_notes_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
