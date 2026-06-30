-- Ensure Campaign Center is registered and enabled globally.
INSERT INTO "platform_features" (
  "id",
  "featureKey",
  "name",
  "description",
  "category",
  "version",
  "module",
  "status",
  "releaseType",
  "routePath",
  "apiPrefix",
  "navLabel",
  "isNavItem",
  "blocksAi",
  "blocksJobs",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid(),
  'campaigns',
  'Campaign Center',
  'Marketing campaigns, journeys, and broadcast automation.',
  'Campaigns',
  '1.0.0',
  'campaigns',
  'ENABLED',
  'STANDARD',
  '/campaigns',
  '/campaigns',
  'Campaign Center',
  true,
  false,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("featureKey") DO UPDATE
SET
  "status" = 'ENABLED',
  "updatedAt" = NOW();
