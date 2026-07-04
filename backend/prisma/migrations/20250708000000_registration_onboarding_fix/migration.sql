-- Registration onboarding fix: store pending business name until email verification

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pendingBusinessName" TEXT;
