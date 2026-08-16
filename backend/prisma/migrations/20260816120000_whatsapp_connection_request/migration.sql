-- WhatsApp connection request & time-boxed approval window

-- CreateEnum
CREATE TYPE "WhatsAppConnectionRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'CONNECTED'
);

-- CreateTable
CREATE TABLE "whatsapp_connection_requests" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "status" "WhatsAppConnectionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "windowExpiresAt" TIMESTAMP(3),
  "rejectedByUserId" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "connectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "whatsapp_connection_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_connection_requests_businessId_status_idx" ON "whatsapp_connection_requests"("businessId", "status");
CREATE INDEX "whatsapp_connection_requests_status_idx" ON "whatsapp_connection_requests"("status");
CREATE INDEX "whatsapp_connection_requests_requesterUserId_idx" ON "whatsapp_connection_requests"("requesterUserId");

-- AddForeignKey
ALTER TABLE "whatsapp_connection_requests"
  ADD CONSTRAINT "whatsapp_connection_requests_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "whatsapp_connection_requests"
  ADD CONSTRAINT "whatsapp_connection_requests_requesterUserId_fkey"
  FOREIGN KEY ("requesterUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "whatsapp_connection_requests"
  ADD CONSTRAINT "whatsapp_connection_requests_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "whatsapp_connection_requests"
  ADD CONSTRAINT "whatsapp_connection_requests_rejectedByUserId_fkey"
  FOREIGN KEY ("rejectedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS (defense in depth; app uses the service role which bypasses RLS)
ALTER TABLE "whatsapp_connection_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_connection_requests_service_only"
  ON "whatsapp_connection_requests"
  FOR ALL
  USING (false)
  WITH CHECK (false);
