-- RAG knowledge chunks + AI analytics engine

ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "memorySummary" TEXT,
  ADD COLUMN IF NOT EXISTS "memorySummaryAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "memoryMessageCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "documentId" TEXT,
  "versionId" TEXT,
  "title" TEXT,
  "category" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "language" TEXT NOT NULL DEFAULT 'so',
  "content" TEXT NOT NULL,
  "embedding" JSONB,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "chunkIndex" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_usage_events" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "conversationId" TEXT,
  "customerId" TEXT,
  "messageId" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "totalTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostUsd" DECIMAL(12,6),
  "latencyMs" INTEGER,
  "promptChars" INTEGER NOT NULL DEFAULT 0,
  "responseChars" INTEGER NOT NULL DEFAULT 0,
  "retrievedChunkCount" INTEGER NOT NULL DEFAULT 0,
  "retrievedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "intent" TEXT,
  "route" TEXT,
  "usedRag" BOOLEAN NOT NULL DEFAULT false,
  "usedSummary" BOOLEAN NOT NULL DEFAULT false,
  "summaryChars" INTEGER NOT NULL DEFAULT 0,
  "knowledgeChars" INTEGER NOT NULL DEFAULT 0,
  "baselineTokensEstimate" INTEGER NOT NULL DEFAULT 0,
  "tokenSavingsPercent" DOUBLE PRECISION,
  "fallbackUsed" BOOLEAN NOT NULL DEFAULT false,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "errorMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_daily_rollups" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "totalRequests" INTEGER NOT NULL DEFAULT 0,
  "totalConversations" INTEGER NOT NULL DEFAULT 0,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "totalTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostUsd" DECIMAL(12,4) NOT NULL DEFAULT 0,
  "avgLatencyMs" INTEGER NOT NULL DEFAULT 0,
  "retrievedChunks" INTEGER NOT NULL DEFAULT 0,
  "avgRetrievedChunks" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "tokenSavingsTokens" INTEGER NOT NULL DEFAULT 0,
  "tokenSavingsPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "fallbackCount" INTEGER NOT NULL DEFAULT 0,
  "providerBreakdown" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_daily_rollups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_conversation_metrics" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "customerId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "totalTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostUsd" DECIMAL(12,6),
  "retrievedChunks" INTEGER NOT NULL DEFAULT 0,
  "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "providers" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "summaryGenerated" BOOLEAN NOT NULL DEFAULT false,
  "completionStatus" TEXT,
  "avgResponseMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_conversation_metrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ai_customer_metrics" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  "conversationCount" INTEGER NOT NULL DEFAULT 0,
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
  "productsDiscussed" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "topQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "avgResponseMs" INTEGER,
  "primaryLanguage" TEXT,
  "primaryChannel" TEXT DEFAULT 'whatsapp',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_customer_metrics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "knowledge_chunks_businessId_isActive_idx" ON "knowledge_chunks"("businessId", "isActive");
CREATE INDEX IF NOT EXISTS "knowledge_chunks_businessId_category_idx" ON "knowledge_chunks"("businessId", "category");
CREATE INDEX IF NOT EXISTS "knowledge_chunks_documentId_idx" ON "knowledge_chunks"("documentId");
CREATE INDEX IF NOT EXISTS "knowledge_chunks_businessId_updatedAt_idx" ON "knowledge_chunks"("businessId", "updatedAt");

CREATE INDEX IF NOT EXISTS "ai_usage_events_businessId_createdAt_idx" ON "ai_usage_events"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "ai_usage_events_conversationId_idx" ON "ai_usage_events"("conversationId");
CREATE INDEX IF NOT EXISTS "ai_usage_events_customerId_idx" ON "ai_usage_events"("customerId");
CREATE INDEX IF NOT EXISTS "ai_usage_events_provider_createdAt_idx" ON "ai_usage_events"("provider", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "ai_daily_rollups_businessId_date_key" ON "ai_daily_rollups"("businessId", "date");
CREATE INDEX IF NOT EXISTS "ai_daily_rollups_businessId_date_idx" ON "ai_daily_rollups"("businessId", "date");

CREATE UNIQUE INDEX IF NOT EXISTS "ai_conversation_metrics_conversationId_key" ON "ai_conversation_metrics"("conversationId");
CREATE INDEX IF NOT EXISTS "ai_conversation_metrics_businessId_idx" ON "ai_conversation_metrics"("businessId");
CREATE INDEX IF NOT EXISTS "ai_conversation_metrics_customerId_idx" ON "ai_conversation_metrics"("customerId");

CREATE UNIQUE INDEX IF NOT EXISTS "ai_customer_metrics_businessId_customerId_key" ON "ai_customer_metrics"("businessId", "customerId");
CREATE INDEX IF NOT EXISTS "ai_customer_metrics_businessId_idx" ON "ai_customer_metrics"("businessId");

ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "knowledge_chunks_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "knowledge_chunks_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_usage_events"
  ADD CONSTRAINT "ai_usage_events_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_daily_rollups"
  ADD CONSTRAINT "ai_daily_rollups_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_conversation_metrics"
  ADD CONSTRAINT "ai_conversation_metrics_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_customer_metrics"
  ADD CONSTRAINT "ai_customer_metrics_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
