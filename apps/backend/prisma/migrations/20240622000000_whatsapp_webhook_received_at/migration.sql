-- Track last successful Meta webhook POST per WhatsApp account
ALTER TABLE "whatsapp_accounts" ADD COLUMN IF NOT EXISTS "lastWebhookReceivedAt" TIMESTAMP(3);
