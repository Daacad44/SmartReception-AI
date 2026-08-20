-- CR-1/CR-3: per-plan monthly message-limit enforcement.
-- Tracks which usage-threshold notifications (80% / 100%) have already been sent
-- for a business in a given billing period, so each threshold fires at most once
-- per period. The unique constraint makes the dedup atomic under concurrent
-- inbound messages; a new periodStart (calendar month, UTC) re-arms the alerts.

CREATE TABLE IF NOT EXISTS "message_usage_alerts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "threshold" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_usage_alerts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "message_usage_alerts_businessId_periodStart_threshold_key"
  ON "message_usage_alerts"("businessId", "periodStart", "threshold");

CREATE INDEX IF NOT EXISTS "message_usage_alerts_businessId_idx"
  ON "message_usage_alerts"("businessId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'message_usage_alerts_businessId_fkey'
  ) THEN
    ALTER TABLE "message_usage_alerts"
      ADD CONSTRAINT "message_usage_alerts_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "businesses"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
