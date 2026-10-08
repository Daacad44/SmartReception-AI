-- Earlier application versions inferred that any slug-shaped local template
-- name was already approved in Meta. That assumption causes Graph error 132001.
-- Fail closed: operators must explicitly re-link the exact approved Meta name.
UPDATE "message_templates"
SET "whatsappTemplateName" = NULL
WHERE "whatsappTemplateName" IS NOT NULL
  AND lower(trim("whatsappTemplateName")) = lower(trim("name"));
