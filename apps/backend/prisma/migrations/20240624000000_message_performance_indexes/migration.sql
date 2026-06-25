-- Performance indexes for conversation and message queries
CREATE INDEX IF NOT EXISTS "messages_conversation_created_at_idx" ON "messages" ("conversationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "conversations_business_last_message_idx" ON "conversations" ("businessId", "lastMessageAt" DESC);
