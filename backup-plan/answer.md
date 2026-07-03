# Supabase Audit — Full Answers (SmartReception-AI)

> **Scope note:** This is a find-and-document audit. No Express code was written.
> Every claim below was verified against the actual repo (file paths + line numbers
> given). Negative results ("does not exist") are stated explicitly because for a
> migration audit, confirmed absence is as important as presence.

> **Headline:** This is already a Node/Express + Prisma app running on plain Postgres
> (Supabase is only the managed Postgres host + Storage + Realtime). Supabase Auth, DB
> functions, triggers, cron, Edge Functions, and per-table RLS are **not used**. The only
> load-bearing Supabase couplings are **Storage** (2 buckets) and **Realtime**
> (`postgres_changes` CDC + backend `broadcast`).

---

## 1. Schema & Data

### 1. Tables / columns / constraints / indexes / FKs
- Source of truth: `apps/backend/prisma/schema.prisma` (~3,585 lines). Datasource is
  `postgresql` using `DATABASE_URL` (pooled, PgBouncer port 6543) + `DIRECT_URL` (direct
  port 5432, migrations only). No Supabase-proprietary datasource config.
- **99 models**, every one `@@map`-ed to a snake_case table (100% mapped).
- **All primary keys** are `String @id @default(uuid())` (application-generated UUIDs via
  Prisma, NOT Postgres `gen_random_uuid()` or `auth.uid()`), except natural-key singletons:
  `AiBusinessSnapshot.businessId @id`, `BusinessFinancialProfile.businessId @id`,
  `PlatformFinancialConfig.id @id @default("default")`.
- Tenant isolation is **application-layer only**: nearly every child model carries
  `businessId String` FK with `onDelete: Cascade` plus `@@index([businessId, ...])`.
  There is **no database-level tenant isolation** (no RLS) on any child table except the
  single deny-all case in §2.

Security/tenant-relevant models (reproduced):

```prisma
model Business {                     // table "businesses" — tenant root
  id              String @id @default(uuid())
  name            String
  slug            String @unique
  whatsappStatus  WhatsAppStatus       @default(NOT_CONNECTED)
  licenseStatus   BusinessLicenseStatus@default(PENDING)
  isLicenseLocked Boolean @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  // ~50 back-relations (members, customers, conversations, appointments, subscriptions…)
  @@index([slug]); @@index([isActive]); @@map("businesses")
}

model User {                         // table "users" — CUSTOM auth principal (not auth.users)
  id              String  @id @default(uuid())
  email           String  @unique
  passwordHash    String
  isSuperAdmin    Boolean @default(false)
  totpSecret      String?
  totpEnabled     Boolean @default(false)
  totpBackupCodes String?
  @@index([email]); @@index([isActive]); @@map("users")
}

model BusinessMember {              // table "business_members" — role/tenant membership
  // role UserRole; @@unique([businessId, userId])  — the sole place membership is defined
}

model WhatsAppAccount {             // table "whatsapp_accounts"
  id              String @id @default(uuid())
  businessId      String
  phoneNumberId   String @unique
  phoneNumber     String
  displayName     String?
  wabaId          String?
  accessToken     String?           // Meta token; scoped only by businessId FK (no row RLS)
  webhookVerified Boolean @default(false)
  business        Business @relation(fields:[businessId], references:[id], onDelete: Cascade)
  @@index([businessId]); @@index([phoneNumberId]); @@map("whatsapp_accounts")
}
```

Full model list by domain (name → PK → notable unique/constraints):
- **Catalog/tenant:** `BusinessTypeDefinition`(id=string literal), `Business`(uuid, unique slug)
- **Users/team:** `User`(uuid, unique email), `BusinessMember`(uuid, unique[businessId,userId]),
  `TeamInvitation`(uuid, unique token), `RefreshToken`(uuid, unique token)
- **CRM:** `Customer`(uuid, unique[businessId,phone]), `CustomerTag`(uuid, unique[businessId,name]),
  `CustomerTagAssignment`(composite PK [customerId,tagId]), `CustomerNote`(uuid)
- **Conversations:** `Conversation`(uuid), `Message`(uuid, unique whatsappMsgId),
  `ConversationActivity`(uuid), `ConversationFeedback`(uuid)
- **Appointments:** `Service`, `Appointment`, `AppointmentInternalNote`,
  `AppointmentNotification`(unique[appointmentId,notificationType,channel,recipient]),
  `AppointmentMessageTemplate`(unique[businessId,templateKey,channel]), `AppointmentWorkflow`,
  `AppointmentWorkflowStage`(unique[workflowId,key]), `AppointmentWorkflowTransition`,
  `AppointmentWorkflowRule`, `AppointmentWorkflowTemplate`(unique key), `AppointmentTimelineEvent`,
  `AppointmentWorkflowExecution`, `AppointmentReminderConfig`,
  `AppointmentAutomationSettings`(unique businessId), `AppointmentAnalyticsSnapshot`(unique businessId)
- **Segments/campaigns:** `CustomerSegment`(unique[businessId,name]), `CustomerSegmentMember`(composite),
  `Campaign`, `CampaignRecipient`(unique[campaignId,customerId]), `MessageTemplate`(unique[businessId,name]),
  `CampaignJourney`(unique[businessId,name]), `CampaignJourneyStep`(unique[journeyId,orderIndex]),
  `CampaignJourneyEnrollment`(unique[journeyId,customerId]),
  `CustomerCampaignOptOut`(composite [businessId,customerId]), `CustomerImportJob`
- **Knowledge base:** `KnowledgeBase`, `KnowledgeDocument`, `KnowledgeChunk`
- **WhatsApp:** `WhatsAppAccount`(unique phoneNumberId), `WhatsAppWebhookEvent`(unique eventId)
- **Business profile/AI config:** `BusinessProfile`(unique businessId), `AIConfiguration`
- **Notifications/audit:** `Notification`, `AuditLog`
- **Employee comms:** `Employee`(unique[businessId,phone]), `EmployeeGroup`(unique[businessId,name]),
  `EmployeeGroupMember`(composite), `EmployeeTemplate`, `EmployeeBroadcast`,
  `EmployeeBroadcastRecipient`(unique[broadcastId,employeeId]),
  `EmployeeConversation`(unique[businessId,employeeId]), `EmployeeConversationMessage`, `EmployeeImportJob`
- **Billing:** `Subscription`(unique businessId), `Invoice`(unique invoiceNumber)
- **Enterprise subscription/license:** `SubscriptionPlanCatalog`(unique code),
  `BusinessSubscription`(unique businessId), `SubscriptionHistory`, `SubscriptionNotification`,
  `SubscriptionActivityLog`, `SubscriptionPayment`, `SubscriptionTransaction`, `SubscriptionRenewal`,
  `SubscriptionCoupon`(unique code), `SubscriptionDiscount`
- **Governance:** `GovernanceApprovalRequest` (the one table with DB-level RLS — see §2)
- **AI training platform:** `AiTrainingWorkspace`(unique businessId),
  `AiTrainingVersion`(unique[businessId,versionNumber]), `AiTrainingJob`,
  `AiTrainingVerificationRequest`, `AiTrainingSessionLog`(unique jobId), `AiDeploymentRequest`,
  `AiSandboxSession`, `AiSandboxMessage`, `AiTrainer`(unique username — SEPARATE auth principal),
  `AiTrainerBusiness`(composite), `AiTrainerLoginHistory`, `AiTrainingInsight`, `AiTrainingAuditLog`
- **AI analytics:** `AiUsageEvent`, `AiDailyRollup`(unique[businessId,date]),
  `AiConversationMetric`(unique conversationId), `AiCustomerMetric`(unique[businessId,customerId]),
  `AiBusinessSnapshot`(PK businessId)
- **Platform feature mgmt:** `PlatformFeature`(unique featureKey),
  `PlatformFeatureDependency`(unique[featureId,dependsOnFeatureId]),
  `PlatformFeatureBusinessScope`(unique[featureId,businessId]),
  `PlatformFeatureVerificationRequest`, `PlatformFeatureAuditLog`
- **Financial intelligence:** `PlatformFinancialConfig`(PK "default"),
  `BusinessFinancialProfile`(PK businessId), `PlatformFinancialSnapshot`(unique snapshotDate),
  `FinancialAuditLog`, `FinancialAlert`, `FinancialCostEvent`

### 2. Enums / custom types / views
- **74 enums** (condensed): `UserRole`(OWNER/ADMIN/MANAGER/AGENT/VIEWER/RECEPTIONIST/STAFF),
  `Industry`(18), `SubscriptionPlan`(FREE…CUSTOM), `SubscriptionStatus`, `BusinessLicenseStatus`,
  `SubscriptionDurationPreset`, `SubscriptionActivityAction`, `SubscriptionNotificationType`,
  `SubscriptionPaymentStatus`, `SubscriptionPaymentMethod`(incl. EVC_PLUS/ZAAD/EDAHAB/PREMIER_WALLET),
  `SubscriptionTransactionType/Status`, `SubscriptionDiscountType`, `SubscriptionNotificationChannel/Status`,
  `ConversationStatus/Team`, `ResolutionMethod`, `ConversationActivityType`,
  `MessageDirection/Type/Status`, `AppointmentStatus`(14), `AppointmentNotificationChannel/Type/Status`,
  `AppointmentWorkflowEventType/ActionType`, `AppointmentTimelineActorType`, `DocumentType/Status`,
  `NotificationType`, `CustomerType`, `AppointmentPriority`, `LeadStatus`,
  `CampaignType`(19)/`Schedule`/`MessageType`/`Status`/`RecipientStatus`, `JourneyStatus/EnrollmentStatus`,
  `ImportJobStatus`, `AuditAction`, `GovernanceActionType`, `GovernanceApprovalStatus`, `InvoiceStatus`,
  `WhatsAppStatus`, `BusinessProfileExtractionStatus`, `EmployeeStatus/EmploymentType`,
  `EmployeeBroadcastType/Schedule/Status`, `EmployeeDeliveryStatus`, `AiTrainingJobType/Status`,
  `AiTrainingVersionStatus`, `AiDeploymentRequestStatus`, `AiSandboxMessageRole`,
  `AiTrainingAuditAction`, `AiTrainingOperation`, `AiTrainingVerificationStatus`,
  `PlatformFeatureStatus/Visibility/ReleaseType/Scope`, `PlatformFeatureVerificationAction/Status`,
  `PlatformFeatureAuditAction`, `BillingCycle`, `FinancialAlertType/Severity`, `FinancialCostProviderKey`.
- **No Prisma `view` blocks** (views feature not used).
- **No `Unsupported(...)` raw column types** anywhere.

### 3. Computed / generated columns
- **None.** No Prisma generated columns; no DB-side computed columns. Derived values
  (rollups, snapshots, cost aggregates) are computed in the Node app and persisted to
  ordinary columns.

---

## 2. Row Level Security (critical)

A repo-wide grep for `ROW LEVEL SECURITY | CREATE POLICY | ENABLE ROW LEVEL SECURITY |
auth.uid() | auth.jwt() | CREATE FUNCTION | CREATE OR REPLACE FUNCTION | CREATE TRIGGER |
pg_cron | cron.schedule | CREATE EXTENSION` matched in **exactly 3 files** (all under
`apps/backend/prisma/migrations/`) and nowhere else.

### 4. Every RLS policy
Only two files contain policies:

**`20240616000001_storage_policies/migration.sql`** (targets Supabase's built-in
`storage.objects`, NOT an app table):
```sql
CREATE POLICY "Service role full access on knowledge documents"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'knowledge-documents')
WITH CHECK (bucket_id = 'knowledge-documents');

CREATE POLICY "Authenticated users can read knowledge files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'knowledge-documents' AND (storage.foldername(name))[1] = 'knowledge');

CREATE POLICY "Authenticated users can upload knowledge files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'knowledge-documents' AND (storage.foldername(name))[1] = 'knowledge');

CREATE POLICY "Authenticated users can delete knowledge files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'knowledge-documents' AND (storage.foldername(name))[1] = 'knowledge');
```
Keyed only on folder name `knowledge` — **not per-business** at the DB level. Real tenant
isolation for this bucket is done by the backend (service-role key) constructing paths as
`knowledge/{businessId}/{uuid}-filename`.

**`20250706000001_governance_rls/migration.sql`** (the ONLY app table with RLS):
```sql
ALTER TABLE "governance_approval_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "governance_requests_service_only"
  ON "governance_approval_requests"
  FOR ALL
  USING (false)
  WITH CHECK (false);
```
A **deny-all** policy ("defense in depth"): blocks anon/authenticated PostgREST access
entirely; the Express backend's Prisma connection (privileged role) bypasses RLS and does
all real access control.

### 5. Tables with RLS disabled — and why
- **98 of 99 app tables have RLS disabled** (never enabled). Reason: the app never exposes
  Postgres directly to clients (no PostgREST usage) — all access is via the Express API
  using Prisma over a privileged connection. Authorization is enforced in Express
  middleware/`businessId`-scoped queries, so per-table RLS was never implemented.

### 6. Policies referencing `auth.uid()` / `auth.jwt()` / custom claims
- **None.** Zero matches for `auth.uid()` or `auth.jwt()` anywhere in the repo. The app
  does not use PostgREST/Supabase row identity at all.

> **Discrepancy to verify (open question):** `docs/EMERGENCY_FIX_REPORT.md` §4/§8 claims
> "RLS policies present for all core tables" / "business-scoped policies." The committed
> migration history does **not** support this — only `governance_approval_requests` (deny-all)
> has RLS. If per-table policies were applied directly via the Supabase dashboard/MCP
> outside a committed migration, that state is unversioned in git and must be verified
> against the live Supabase project before concluding there is nothing to port.

---

## 3. Database Functions, Triggers, Jobs

### 7. Postgres functions
- **None.** Zero `CREATE FUNCTION` / `CREATE OR REPLACE FUNCTION` (plpgsql or SQL) anywhere
  in the repo. All logic (timestamps via Prisma `@default(now())`/`@updatedAt`, cascades via
  Prisma `onDelete`, derived values) lives in the Node/Prisma app layer.

### 8. Triggers
- **None.** Zero `CREATE TRIGGER` anywhere.

### 9. Scheduled jobs (pg_cron etc.)
- **None.** Zero `pg_cron` / `cron.schedule`. All scheduling (campaign sends, appointment
  reminders, subscription expiry) is handled by **BullMQ + Redis** worker processes in the
  Node app (see `apps/backend/src/worker.ts`, `apps/backend/src/infrastructure/queue/`).
- Only non-Prisma DDL present: `CREATE EXTENSION IF NOT EXISTS vector;`
  (`20240620000000_pgvector/migration.sql`) — enabled but **unused** (embeddings stored as
  JSON; cosine similarity computed in-app).

---

## 4. Auth

### 10. Enabled auth providers
- **Email + password only**, plus **email OTP verification** (6-digit codes via Resend).
  No OAuth, no magic link, no phone auth. **Supabase Auth is not used at all.**

### 11. Auth Hooks (custom access token hook, before-user-created, etc.)
- **None.** No Supabase Auth Hooks exist (no `supabase/` project, no `auth.users`, no
  `auth.uid()`). All login/registration logic is custom Express controllers/services in
  `apps/backend/src/modules/auth/` and `apps/backend/src/infrastructure/auth/`.

### 12. Custom JWT claims
- JWTs are minted by `apps/backend/src/infrastructure/auth/token.service.ts` (`jwt.sign`
  with `config.jwt.secret`). Access-token payload claims: `userId`, `businessId`, `role`,
  `isSuperAdmin`. These are **app-issued JWTs**, unrelated to any Supabase JWT.

### 13. Session / refresh token expiry
- Access token: **15 minutes** (`config.jwt.expiresIn`). Refresh token: **7 days**
  (`config.jwt.refreshExpiresIn`), signed with a separate `config.jwt.refreshSecret`,
  persisted in the `refresh_tokens` table (rotating). Verified in `token.service.ts`.
- Supporting auth infra: `password.service.ts` (bcryptjs), `totp.service.ts`
  (TOTP + bcrypt-hashed backup codes), `otp.service.ts` (email OTP), `login-lockout.service.ts`.

---

## 5. Storage

### 14. Buckets, public/private, access policies
- **`knowledge-documents`** — private; created by
  `apps/backend/src/infrastructure/storage/supabase-storage.service.ts` (`ensureBucket`,
  `public:false`, 10MB limit, MIME allowlist PDF/DOCX/DOC/TXT). Signed URLs valid **1 year**.
  Accessed via the `UnifiedStorageService` (`storage/index.ts`) which prefers Supabase and
  **falls back to Cloudflare R2** (`r2.service.ts`) when Supabase isn't configured. RLS
  policies on `storage.objects` for this bucket documented in §2/§4.
- **`whatsapp-media`** — private; created/managed by
  `apps/backend/src/infrastructure/whatsapp/whatsapp-media.service.ts` (own service-role
  client, `public:false`). Signed URLs valid **7 days**. **Supabase-only — no R2 fallback.**
- Provider-selection logic (`storage/index.ts`):
  ```
  get provider() {
    if (isSupabaseStorageConfigured()) return supabaseStorageService; // primary
    if (isR2Configured()) return r2StorageService;                    // fallback
    throw ServiceUnavailableError(...);
  }
  ```

### 15. Storage-triggered functions
- **None.** No functions run on upload/delete. Post-upload processing (e.g. knowledge
  document text extraction/indexing) is triggered by the Express app enqueuing BullMQ jobs,
  not by Supabase Storage triggers.

---

## 6. Edge Functions

### 16. Deployed Edge Functions
- **None.** There is **no `supabase/` CLI directory** anywhere in the repo (no `config.toml`,
  no `supabase/functions/`, no `supabase/migrations/`, no `.supabase/` state). No Edge
  Functions exist. All server logic is the Express app (`apps/backend`) + Vercel serverless
  entrypoints (`api/index.js`, `api/webhook.js`).

---

## 7. Realtime

### 17. Frontend realtime subscriptions
All in `apps/frontend/src/hooks/useRealtime.ts` (client from
`apps/frontend/src/lib/supabase.ts`, anon key):

- **`useBusinessRealtime(userId)`** — channel `business-{businessId}`:
  - `broadcast` event `conversation_update` → invalidate `conversations`, `conversations/summary`,
    `dashboard/bundle`, `notifications` (+ `messages`/`conversation-activity` for the conv).
  - `broadcast` event `business_update` → invalidate `notifications`; and by `type`:
    `appointment`→`appointments`, `campaign`→`campaigns`, `customer`→`customers`.
  - `postgres_changes` `*` on `conversations` (filter `businessId=eq.{id}`) → invalidate
    conversations/summary/dashboard.
  - `postgres_changes` `*` on `appointments` (filter `businessId=eq.{id}`) → `appointments`.
  - `postgres_changes` `*` on `customers` (filter `businessId=eq.{id}`) → `customers`.
  - `postgres_changes` `INSERT` on `notifications` (filter `businessId=eq.{id}`) → `notifications`.
  - `postgres_changes` `*` on `notifications` (filter `userId=eq.{userId}`) → `notifications`.
- **`useConversationRealtime(conversationId)`** — channel `messages-{conversationId}`:
  - `postgres_changes` `*` on `messages` (filter `conversationId=eq.{id}`) → invalidate
    messages/conversations/summary/dashboard.
  - `postgres_changes` `UPDATE` on `conversations` (filter `id=eq.{id}`) → same.

Backend **publishes** the broadcast events via
`apps/backend/src/infrastructure/realtime/broadcast.service.ts` (service-role
`createClient`, `channel.send({type:'broadcast', event:'conversation_update'|'business_update', payload})`),
called from ~14 services (conversations, appointments, campaigns, ai-reply, menu-reply,
workflow-engine, conversation-handoff/feedback/activity, business-snapshot, incoming-message, etc.).

`postgres_changes` depends on the Supabase logical-replication publication, defined in
**`20240620000001_realtime_publication/migration.sql`**:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

---

## 8. Frontend → Supabase Surface Area

### 18. Every `.from(` / `.rpc(` / `.storage.` / `.auth.` / `.channel(` call
Grep of `apps/frontend/src` results:
- **`.from(`** — every hit is JavaScript `Array.from(...)` (AnalyticsPage, DashboardPage,
  OtpInput, LoadingState, EmployeeCommunicationPage, etc.). **Zero Supabase `.from()` calls.**
- **`.rpc(`** — **zero.**
- **`.storage.`** — **zero.**
- **`.auth.`** — **zero.**
- **`.channel(`** — only in `apps/frontend/src/hooks/useRealtime.ts`:
  - L18 `supabase.channel(`business-${businessId}`)`
  - L138 `supabase.channel(`messages-${conversationId}`)`
- **`createClient`** — only `apps/frontend/src/lib/supabase.ts:14` (anon key).
- **`removeChannel`** — `useRealtime.ts:114`, `:162`.

**Conclusion:** the entire frontend data + auth surface already goes through the Express
API via the axios `api` client (`apps/frontend/src/lib/api.ts`): request interceptor adds
`Authorization: Bearer <accessToken>` (L71–73) + `X-Business-Id` (L75); response interceptor
refreshes on 401 (L116+, calling `/auth/refresh`). Tokens are held in the Zustand
`auth.store`. **There are NO Supabase data calls to convert into new Express routes** — the
routes already exist. The only frontend Supabase dependency to replace is the realtime
subscription in `useRealtime.ts`.

---

## 9. Environment / Config

### 19. Env vars / keys (anon vs service role) + client-side leak check
- **Backend** (`apps/backend/src/config/index.ts`, `supabase` block ~L140):
  - `SUPABASE_URL` (or `VITE_SUPABASE_URL` fallback)
  - `SUPABASE_SERVICE_ROLE_KEY` — **service-role key, backend-only** (line 142)
  - `SUPABASE_ANON_KEY` (present but backend realtime/storage use the service-role key)
  - Consumed by exactly 3 backend Supabase clients: `supabase-storage.service.ts`,
    `whatsapp-media.service.ts`, `realtime/broadcast.service.ts`.
  - **Postgres access does NOT use a Supabase client** — it is Prisma over
    `DATABASE_URL`/`DIRECT_URL`.
- **Frontend** (`apps/frontend/src/lib/supabase-config.ts`):
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — **anon key only**, used solely to build
    the realtime client (`lib/supabase.ts`).
- **Security check result: ✅ CLEAN.** The service-role key is never referenced in
  `apps/frontend`. No service-role key is bundled into client code. (Confirmed by docs too:
  `docs/ENVIRONMENT.md`, `docs/PRODUCTION_AUDIT.md` — "Service role key server-side only.")

---

## Confirmed negative results (for the migration to rely on)
- No Supabase Auth / Auth Hooks / `auth.users` / `auth.uid()` / `auth.jwt()`.
- No Postgres functions, triggers, or `pg_cron` jobs.
- No Edge Functions / no `supabase/` CLI project.
- No per-business RLS on app tables (only 1 deny-all on `governance_approval_requests`).
- No Supabase `.from()`/`.rpc()`/`.storage.`/`.auth.` usage in the frontend.
- No service-role key on the client.

## Open questions (cannot be answered from the repo alone)
1. **Live-project RLS:** verify whether dashboard-applied RLS policies/functions exist on the
   live Supabase project that aren't in git (the `EMERGENCY_FIX_REPORT.md` claim).
2. **Object migration:** how many objects currently live in Supabase Storage
   (`knowledge-documents`, `whatsapp-media`) that would need bulk-copying to R2/S3.
3. **Connection pooling:** whether the target Postgres host provides pooling equivalent to
   Supabase's PgBouncer (needed for serverless).
4. **Realtime replacement target:** confirm the intended replacement transport (WebSocket vs
   SSE) and host, since Vercel serverless can't hold long-lived sockets.
