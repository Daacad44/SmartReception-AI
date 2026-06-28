-- Migrate legacy conversation statuses to handoff statuses (run after enum values are committed)

UPDATE "conversations"
SET "status" = 'AI_HANDLING', "aiStartTime" = COALESCE("aiStartTime", "createdAt")
WHERE "status" = 'OPEN' AND "isAiEnabled" = true AND "assignedToId" IS NULL;

UPDATE "conversations"
SET "status" = 'HUMAN_HANDLING', "humanStartTime" = COALESCE("humanStartTime", "updatedAt")
WHERE "status" = 'OPEN' AND ("isAiEnabled" = false OR "assignedToId" IS NOT NULL);

UPDATE "conversations"
SET "status" = 'HUMAN_NEEDED', "transferTime" = COALESCE("transferTime", "updatedAt")
WHERE "status" = 'PENDING';

ALTER PUBLICATION supabase_realtime ADD TABLE conversation_activities;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_feedback;
