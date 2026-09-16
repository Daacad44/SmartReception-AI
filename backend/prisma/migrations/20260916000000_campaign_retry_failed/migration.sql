-- Campaign Center "Resend Failed": retry history on campaigns.

ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "lastRetryAt" TIMESTAMP(3);
