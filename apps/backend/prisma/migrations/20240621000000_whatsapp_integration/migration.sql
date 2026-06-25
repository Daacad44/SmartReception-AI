-- WhatsApp account status fields and webhook replay protection
ALTER TABLE "whatsapp_accounts" ADD COLUMN IF NOT EXISTS "phoneNumberStatus" TEXT DEFAULT 'unknown';
ALTER TABLE "whatsapp_accounts" ADD COLUMN IF NOT EXISTS "webhookStatus" TEXT DEFAULT 'pending';
ALTER TABLE "whatsapp_accounts" ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "whatsapp_webhook_events" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "businessId" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_webhook_events_eventId_key" ON "whatsapp_webhook_events"("eventId");
CREATE INDEX IF NOT EXISTS "whatsapp_webhook_events_receivedAt_idx" ON "whatsapp_webhook_events"("receivedAt");
CREATE INDEX IF NOT EXISTS "whatsapp_webhook_events_businessId_idx" ON "whatsapp_webhook_events"("businessId");
