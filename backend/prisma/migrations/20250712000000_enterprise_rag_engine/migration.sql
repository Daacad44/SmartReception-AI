-- Enterprise RAG: knowledge chunk intelligence metadata

ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "source" TEXT;
ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "embeddingVersion" TEXT;
ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "knowledgeVersion" INTEGER;
ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "confidenceScore" DOUBLE PRECISION;
ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "usageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "lastRetrievedAt" TIMESTAMP(3);
ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "lastRetrievalScore" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "knowledge_chunks_businessId_status_idx" ON "knowledge_chunks"("businessId", "status");
