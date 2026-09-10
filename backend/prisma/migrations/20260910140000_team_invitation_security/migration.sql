-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- AlterTable
ALTER TABLE "team_invitations"
  ADD COLUMN "invitedById" TEXT,
  ADD COLUMN "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "tokenHash" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Legacy plaintext tokens remain valid via dual lookup; copy into tokenHash.
UPDATE "team_invitations" SET "tokenHash" = "token" WHERE "tokenHash" IS NULL;
UPDATE "team_invitations" SET "status" = 'ACCEPTED' WHERE "acceptedAt" IS NOT NULL;

ALTER TABLE "team_invitations" ALTER COLUMN "tokenHash" SET NOT NULL;
ALTER TABLE "team_invitations" ALTER COLUMN "token" DROP NOT NULL;

CREATE UNIQUE INDEX "team_invitations_tokenHash_key" ON "team_invitations"("tokenHash");
CREATE INDEX "team_invitations_businessId_email_status_idx" ON "team_invitations"("businessId", "email", "status");

ALTER TABLE "team_invitations"
  ADD CONSTRAINT "team_invitations_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep a single pending invitation per business + email.
DELETE FROM "team_invitations" a
USING "team_invitations" b
WHERE a.status = 'PENDING'
  AND b.status = 'PENDING'
  AND a."acceptedAt" IS NULL
  AND b."acceptedAt" IS NULL
  AND a."revokedAt" IS NULL
  AND b."revokedAt" IS NULL
  AND a."businessId" = b."businessId"
  AND a.email = b.email
  AND a."createdAt" < b."createdAt";

CREATE UNIQUE INDEX "team_invitations_pending_business_email_key"
  ON "team_invitations" ("businessId", "email")
  WHERE "status" = 'PENDING' AND "acceptedAt" IS NULL AND "revokedAt" IS NULL;
