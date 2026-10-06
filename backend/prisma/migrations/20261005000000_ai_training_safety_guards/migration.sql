-- Phase 0/1 AI Agent Studio safety guards.
-- Resolve any legacy duplicates before adding partial unique indexes.

WITH ranked_active_jobs AS (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "businessId"
           ORDER BY "createdAt" DESC, "id" DESC
         ) AS row_number
  FROM "ai_training_jobs"
  WHERE "status" IN ('QUEUED', 'RUNNING')
)
UPDATE "ai_training_jobs" AS job
SET "status" = 'FAILED',
    "error" = 'Superseded while installing the active-job safety guard',
    "completedAt" = COALESCE(job."completedAt", NOW()),
    "updatedAt" = NOW()
FROM ranked_active_jobs AS ranked
WHERE job."id" = ranked."id"
  AND ranked.row_number > 1;

WITH ranked_pending_requests AS (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "businessId", "versionId"
           ORDER BY "requestedAt" DESC, "id" DESC
         ) AS row_number
  FROM "ai_deployment_requests"
  WHERE "status" = 'PENDING'
)
UPDATE "ai_deployment_requests" AS request
SET "status" = 'CANCELLED',
    "reviewedAt" = COALESCE(request."reviewedAt", NOW())
FROM ranked_pending_requests AS ranked
WHERE request."id" = ranked."id"
  AND ranked.row_number > 1;

WITH ranked_production_versions AS (
  SELECT version."id",
         ROW_NUMBER() OVER (
           PARTITION BY version."businessId"
           ORDER BY
             CASE WHEN workspace."productionVersionId" = version."id" THEN 0 ELSE 1 END,
             version."createdAt" DESC,
             version."id" DESC
         ) AS row_number
  FROM "ai_training_versions" AS version
  LEFT JOIN "ai_training_workspaces" AS workspace
    ON workspace."businessId" = version."businessId"
  WHERE version."status" = 'PRODUCTION'
)
UPDATE "ai_training_versions" AS version
SET "status" = 'ARCHIVED',
    "updatedAt" = NOW()
FROM ranked_production_versions AS ranked
WHERE version."id" = ranked."id"
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "ai_training_jobs_one_active_per_business"
  ON "ai_training_jobs" ("businessId")
  WHERE "status" IN ('QUEUED', 'RUNNING');

CREATE UNIQUE INDEX IF NOT EXISTS "ai_deployment_requests_one_pending_per_version"
  ON "ai_deployment_requests" ("businessId", "versionId")
  WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX IF NOT EXISTS "ai_training_versions_one_production_per_business"
  ON "ai_training_versions" ("businessId")
  WHERE "status" = 'PRODUCTION';
