-- Track Graph API send results on WhatsApp accounts for diagnostics
ALTER TABLE "whatsapp_accounts" ADD COLUMN IF NOT EXISTS "lastGraphApiResponse" JSONB;
ALTER TABLE "whatsapp_accounts" ADD COLUMN IF NOT EXISTS "lastGraphApiError" JSONB;
ALTER TABLE "whatsapp_accounts" ADD COLUMN IF NOT EXISTS "lastOutgoingAt" TIMESTAMP(3);
