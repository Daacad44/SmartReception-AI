ALTER TABLE "whatsapp_accounts"
  ADD COLUMN IF NOT EXISTS "reengagementTemplateHasBodyVariable" BOOLEAN NOT NULL DEFAULT false;
