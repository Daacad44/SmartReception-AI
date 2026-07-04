-- Persist WhatsApp 24h customer care window anchors for reliable session detection.

ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "lastCustomerMessageAt" TIMESTAMP(3);

ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "lastCustomerMessageAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "customers_businessId_lastCustomerMessageAt_idx"
  ON "customers" ("businessId", "lastCustomerMessageAt");

CREATE INDEX IF NOT EXISTS "conversations_businessId_lastCustomerMessageAt_idx"
  ON "conversations" ("businessId", "lastCustomerMessageAt");

-- Backfill from existing inbound messages (prefer Meta whatsappTimestamp when present).
UPDATE "customers" c
SET "lastCustomerMessageAt" = sub.inbound_at
FROM (
  SELECT
    conv."customerId" AS customer_id,
    MAX(
      COALESCE(
        CASE
          WHEN NULLIF(m.metadata->>'whatsappTimestamp', '') ~ '^[0-9]+$'
            THEN to_timestamp((m.metadata->>'whatsappTimestamp')::bigint)
          ELSE NULL
        END,
        m."createdAt"
      )
    ) AS inbound_at
  FROM "messages" m
  INNER JOIN "conversations" conv ON conv.id = m."conversationId"
  WHERE m.direction = 'INBOUND'
  GROUP BY conv."customerId"
) sub
WHERE c.id = sub.customer_id
  AND (c."lastCustomerMessageAt" IS NULL OR c."lastCustomerMessageAt" < sub.inbound_at);

UPDATE "conversations" conv
SET "lastCustomerMessageAt" = sub.inbound_at
FROM (
  SELECT
    m."conversationId" AS conversation_id,
    MAX(
      COALESCE(
        CASE
          WHEN NULLIF(m.metadata->>'whatsappTimestamp', '') ~ '^[0-9]+$'
            THEN to_timestamp((m.metadata->>'whatsappTimestamp')::bigint)
          ELSE NULL
        END,
        m."createdAt"
      )
    ) AS inbound_at
  FROM "messages" m
  WHERE m.direction = 'INBOUND'
  GROUP BY m."conversationId"
) sub
WHERE conv.id = sub.conversation_id
  AND (conv."lastCustomerMessageAt" IS NULL OR conv."lastCustomerMessageAt" < sub.inbound_at);
