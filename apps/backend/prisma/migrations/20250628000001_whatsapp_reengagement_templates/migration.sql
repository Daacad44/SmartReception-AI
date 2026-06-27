-- WhatsApp re-engagement template settings (send outside 24h session window)
ALTER TABLE "whatsapp_accounts"
  ADD COLUMN IF NOT EXISTS "reengagementTemplateName" TEXT,
  ADD COLUMN IF NOT EXISTS "reengagementTemplateLanguage" TEXT DEFAULT 'en';

ALTER TABLE "message_templates"
  ADD COLUMN IF NOT EXISTS "whatsappTemplateName" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappTemplateLanguage" TEXT;
