CREATE TYPE "AiAgentKnowledgeStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'STALE', 'ARCHIVED');

CREATE TABLE "ai_agent_knowledge_sources" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "status" "AiAgentKnowledgeStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "contentChecksum" TEXT NOT NULL,
  "sourceVersion" INTEGER NOT NULL DEFAULT 1,
  "reviewNotes" TEXT,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "freshnessDueAt" TIMESTAMP(3),
  "lastVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_agent_knowledge_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_agent_knowledge_revisions" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "contentChecksum" TEXT NOT NULL,
  "snapshotData" JSONB NOT NULL,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_agent_knowledge_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_agent_knowledge_sources_agentId_documentId_key" ON "ai_agent_knowledge_sources"("agentId", "documentId");
CREATE UNIQUE INDEX "ai_agent_knowledge_sources_agentId_contentChecksum_key" ON "ai_agent_knowledge_sources"("agentId", "contentChecksum");
CREATE INDEX "ai_agent_knowledge_sources_businessId_status_idx" ON "ai_agent_knowledge_sources"("businessId", "status");
CREATE INDEX "ai_agent_knowledge_sources_agentId_freshnessDueAt_idx" ON "ai_agent_knowledge_sources"("agentId", "freshnessDueAt");
CREATE UNIQUE INDEX "ai_agent_knowledge_revisions_sourceId_version_key" ON "ai_agent_knowledge_revisions"("sourceId", "version");

ALTER TABLE "ai_agent_knowledge_sources" ADD CONSTRAINT "ai_agent_knowledge_sources_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_knowledge_sources" ADD CONSTRAINT "ai_agent_knowledge_sources_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_knowledge_sources" ADD CONSTRAINT "ai_agent_knowledge_sources_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_knowledge_revisions" ADD CONSTRAINT "ai_agent_knowledge_revisions_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ai_agent_knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
