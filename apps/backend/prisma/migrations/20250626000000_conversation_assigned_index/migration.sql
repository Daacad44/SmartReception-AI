-- CreateIndex
CREATE INDEX IF NOT EXISTS "conversations_businessId_assignedToId_idx" ON "conversations"("businessId", "assignedToId");
