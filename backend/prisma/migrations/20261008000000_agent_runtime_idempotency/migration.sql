-- One runtime execution per inbound WhatsApp message. Remove historical
-- duplicates deterministically before adding the invariant.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "inboundMessageId" ORDER BY "startedAt" ASC, "id" ASC
  ) AS row_number
  FROM "ai_agent_executions"
  WHERE "inboundMessageId" IS NOT NULL
)
DELETE FROM "ai_agent_executions" execution
USING ranked
WHERE execution."id" = ranked."id" AND ranked.row_number > 1;

CREATE UNIQUE INDEX "ai_agent_executions_inboundMessageId_key"
  ON "ai_agent_executions"("inboundMessageId");
