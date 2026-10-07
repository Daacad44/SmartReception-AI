CREATE TYPE "AiAutomationWorkflowStatus" AS ENUM ('DRAFT','VALIDATED','ACTIVE','ARCHIVED');
CREATE TYPE "AiSimulationRunStatus" AS ENUM ('RUNNING','PASSED','FAILED','CANCELLED');
CREATE TYPE "AiAgentIncidentStatus" AS ENUM ('OPEN','ACKNOWLEDGED','RESOLVED');
CREATE TYPE "AiChannelType" AS ENUM ('WHATSAPP','INSTAGRAM','MESSENGER','TIKTOK','WEBCHAT');
CREATE TYPE "AiChannelBindingStatus" AS ENUM ('DISCONNECTED','CONFIGURED','ACTIVE','DEGRADED','PAUSED');

CREATE TABLE "ai_automation_workflows" ("id" TEXT NOT NULL,"businessId" TEXT NOT NULL,"agentId" TEXT NOT NULL,"name" TEXT NOT NULL,"description" TEXT,"status" "AiAutomationWorkflowStatus" NOT NULL DEFAULT 'DRAFT',"revision" INTEGER NOT NULL DEFAULT 1,"triggerType" TEXT NOT NULL DEFAULT 'MESSAGE_RECEIVED',"nodes" JSONB NOT NULL,"edges" JSONB NOT NULL,"validation" JSONB,"publishedAt" TIMESTAMP(3),"createdByUserId" TEXT,"updatedByUserId" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ai_automation_workflows_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ai_automation_workflows_agentId_name_key" ON "ai_automation_workflows"("agentId","name");
CREATE INDEX "ai_automation_workflows_businessId_status_idx" ON "ai_automation_workflows"("businessId","status");

CREATE TABLE "ai_simulation_runs" ("id" TEXT NOT NULL,"businessId" TEXT NOT NULL,"agentId" TEXT NOT NULL,"releaseId" TEXT,"status" "AiSimulationRunStatus" NOT NULL DEFAULT 'RUNNING',"suiteType" TEXT NOT NULL,"scenarios" JSONB NOT NULL,"results" JSONB,"score" DOUBLE PRECISION,"criticalFailures" INTEGER NOT NULL DEFAULT 0,"createdByUserId" TEXT,"startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"completedAt" TIMESTAMP(3),CONSTRAINT "ai_simulation_runs_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ai_simulation_runs_businessId_startedAt_idx" ON "ai_simulation_runs"("businessId","startedAt");
CREATE INDEX "ai_simulation_runs_agentId_status_idx" ON "ai_simulation_runs"("agentId","status");

CREATE TABLE "ai_agent_incidents" ("id" TEXT NOT NULL,"businessId" TEXT NOT NULL,"agentId" TEXT NOT NULL,"status" "AiAgentIncidentStatus" NOT NULL DEFAULT 'OPEN',"severity" TEXT NOT NULL,"type" TEXT NOT NULL,"summary" TEXT NOT NULL,"evidence" JSONB NOT NULL,"acknowledgedById" TEXT,"acknowledgedAt" TIMESTAMP(3),"resolvedById" TEXT,"resolvedAt" TIMESTAMP(3),"resolutionNotes" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ai_agent_incidents_pkey" PRIMARY KEY ("id"));
CREATE INDEX "ai_agent_incidents_businessId_status_severity_idx" ON "ai_agent_incidents"("businessId","status","severity");
CREATE INDEX "ai_agent_incidents_agentId_createdAt_idx" ON "ai_agent_incidents"("agentId","createdAt");

CREATE TABLE "ai_channel_bindings" ("id" TEXT NOT NULL,"businessId" TEXT NOT NULL,"agentId" TEXT NOT NULL,"channel" "AiChannelType" NOT NULL,"status" "AiChannelBindingStatus" NOT NULL DEFAULT 'DISCONNECTED',"externalRef" TEXT NOT NULL DEFAULT 'default',"configuration" JSONB NOT NULL DEFAULT '{}',"capabilities" JSONB NOT NULL DEFAULT '{}',"lastHealthAt" TIMESTAMP(3),"lastError" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "ai_channel_bindings_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "ai_channel_bindings_businessId_channel_externalRef_key" ON "ai_channel_bindings"("businessId","channel","externalRef");
CREATE INDEX "ai_channel_bindings_agentId_status_idx" ON "ai_channel_bindings"("agentId","status");

ALTER TABLE "ai_automation_workflows" ADD CONSTRAINT "ai_automation_workflows_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_automation_workflows" ADD CONSTRAINT "ai_automation_workflows_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_simulation_runs" ADD CONSTRAINT "ai_simulation_runs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_simulation_runs" ADD CONSTRAINT "ai_simulation_runs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_simulation_runs" ADD CONSTRAINT "ai_simulation_runs_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "ai_agent_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_agent_incidents" ADD CONSTRAINT "ai_agent_incidents_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_agent_incidents" ADD CONSTRAINT "ai_agent_incidents_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_channel_bindings" ADD CONSTRAINT "ai_channel_bindings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_channel_bindings" ADD CONSTRAINT "ai_channel_bindings_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ai_channel_bindings" ("id","businessId","agentId","channel","status","capabilities","updatedAt") SELECT gen_random_uuid()::text,"businessId","id",'WHATSAPP','CONFIGURED','{"text":true,"media":true,"interactive":true,"templates":true}'::jsonb,CURRENT_TIMESTAMP FROM "ai_agents" ON CONFLICT DO NOTHING;
