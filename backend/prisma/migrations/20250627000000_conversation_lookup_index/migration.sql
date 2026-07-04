-- Speed up findOrCreateConversation (businessId + customerId + status filter)
CREATE INDEX IF NOT EXISTS "conversations_businessId_customerId_status_idx"
  ON "conversations" ("businessId", "customerId", "status");
