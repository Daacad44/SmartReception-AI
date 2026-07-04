-- AlterEnum
ALTER TYPE "CampaignRecipientStatus" ADD VALUE IF NOT EXISTS 'SENDING';

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "targetCustomerId" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "isSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "runVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "campaign_recipients" ADD COLUMN IF NOT EXISTS "isSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "campaign_recipients" ADD COLUMN IF NOT EXISTS "runVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "campaigns_targetCustomerId_idx" ON "campaigns"("targetCustomerId");
CREATE INDEX IF NOT EXISTS "campaign_recipients_isSent_idx" ON "campaign_recipients"("isSent");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_targetCustomerId_fkey" FOREIGN KEY ("targetCustomerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
