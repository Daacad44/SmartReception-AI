-- Set the three sellable price points: STARTER = $49, BUSINESS = $79, PROFESSIONAL = $129.
-- Existing plan codes and names are kept; only monthly/yearly prices are updated.
-- The INSERT ... ON CONFLICT safety net guarantees the rows exist even on a DB where
-- the original catalog seed never ran.

INSERT INTO "subscription_plans"
  ("id", "code", "name", "description", "monthlyPrice", "yearlyPrice", "sortOrder", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'STARTER',      'Starter',      'Small businesses',  49,  490, 1, NOW()),
  (gen_random_uuid()::text, 'BUSINESS',     'Business',     'Growing teams',     79,  790, 2, NOW()),
  (gen_random_uuid()::text, 'PROFESSIONAL', 'Professional', 'Advanced features', 129, 1290, 3, NOW())
ON CONFLICT ("code") DO UPDATE SET
  "monthlyPrice" = EXCLUDED."monthlyPrice",
  "yearlyPrice"  = EXCLUDED."yearlyPrice",
  "updatedAt"    = NOW();
