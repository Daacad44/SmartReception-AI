CREATE TABLE "platform_system_releases" (
  "id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "releaseNotes" JSONB NOT NULL,
  "minimumVersion" TEXT,
  "isMandatory" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_system_releases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platform_system_releases_version_key" ON "platform_system_releases"("version");
CREATE INDEX "platform_system_releases_publishedAt_idx" ON "platform_system_releases"("publishedAt");

CREATE TABLE "business_system_update_states" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "installedVersion" TEXT NOT NULL DEFAULT '1.1.1',
  "lastCheckedAt" TIMESTAMP(3),
  "lastUpdatedAt" TIMESTAMP(3),
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_system_update_states_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "business_system_update_states_businessId_key" ON "business_system_update_states"("businessId");

CREATE TABLE "business_system_update_installations" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "fromVersion" TEXT NOT NULL,
  "toVersion" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "installedByUserId" TEXT,
  "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_system_update_installations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "business_system_update_installations_businessId_releaseId_key" ON "business_system_update_installations"("businessId","releaseId");
CREATE INDEX "business_system_update_installations_businessId_installedAt_idx" ON "business_system_update_installations"("businessId","installedAt");
ALTER TABLE "business_system_update_states" ADD CONSTRAINT "business_system_update_states_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_system_update_installations" ADD CONSTRAINT "business_system_update_installations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_system_update_installations" ADD CONSTRAINT "business_system_update_installations_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "platform_system_releases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "platform_system_releases" ("id","version","title","summary","releaseNotes","minimumVersion","isMandatory","publishedAt") VALUES
('release-1-2-0','1.2.0','WhatsApp Reliability & AI Agent Studio','Safer WhatsApp templates, governed AI agents, production operations and system update management.','["Fixed Meta template mapping and 24-hour retry handling","Fixed PostgreSQL advisory lock failures","Added AI Agent Studio governance, automation, simulations and SRE","Added tenant-visible system update history"]'::jsonb,'1.1.1',true,CURRENT_TIMESTAMP)
ON CONFLICT ("version") DO NOTHING;
