-- Preserve Meta's asynchronous delivery failure details for campaign operators.
-- Every column is nullable, so existing recipient rows remain valid.
ALTER TABLE "campaign_recipients"
  ADD COLUMN IF NOT EXISTS "failureCode" TEXT,
  ADD COLUMN IF NOT EXISTS "failureTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "failureMessage" TEXT,
  ADD COLUMN IF NOT EXISTS "failureDetails" TEXT,
  ADD COLUMN IF NOT EXISTS "failureHref" TEXT,
  ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "campaign_recipients_whatsappMsgId_idx"
  ON "campaign_recipients"("whatsappMsgId");

-- Retain existing deduplication history while allowing distinct sent,
-- delivered, read, and failed events for the same Meta message id.
UPDATE "whatsapp_webhook_events"
SET "eventId" = CASE
  WHEN "eventType" LIKE 'status:%'
    THEN 'status:' || "eventId" || ':' || LOWER(SUBSTRING("eventType" FROM 8))
  ELSE 'message:' || "eventId"
END
WHERE "eventId" NOT LIKE 'message:%'
  AND "eventId" NOT LIKE 'status:%';
