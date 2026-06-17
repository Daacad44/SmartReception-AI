-- Add email verification token expiry
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailVerifyExpires" TIMESTAMP(3);
