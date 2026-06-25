-- CreateEnum
CREATE TYPE "WhatsAppStatus" AS ENUM ('CONNECTED', 'NOT_CONNECTED');

-- AlterTable
ALTER TABLE "businesses" ADD COLUMN "whatsappStatus" "WhatsAppStatus" NOT NULL DEFAULT 'NOT_CONNECTED';

-- Backfill: workspaces with an active WhatsApp account are CONNECTED
UPDATE "businesses" b
SET "whatsappStatus" = 'CONNECTED'
WHERE EXISTS (
  SELECT 1 FROM "whatsapp_accounts" wa
  WHERE wa."businessId" = b.id AND wa."isActive" = true
);
