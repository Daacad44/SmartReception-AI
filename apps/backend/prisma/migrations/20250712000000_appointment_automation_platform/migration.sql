-- Enterprise Appointment Automation Platform

CREATE TYPE "AppointmentWorkflowEventType" AS ENUM (
  'APPOINTMENT_CREATED',
  'APPOINTMENT_UPDATED',
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_RESCHEDULED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_REJECTED',
  'APPOINTMENT_EXPIRED',
  'REMINDER_SCHEDULED',
  'REMINDER_SENT',
  'CUSTOMER_ARRIVED',
  'CUSTOMER_CHECKED_IN',
  'APPOINTMENT_STARTED',
  'APPOINTMENT_COMPLETED',
  'APPOINTMENT_NO_SHOW',
  'FOLLOW_UP_SCHEDULED',
  'FEEDBACK_REQUESTED',
  'FEEDBACK_RECEIVED',
  'PAYMENT_AWAITING',
  'PAYMENT_RECEIVED',
  'PAYMENT_REFUNDED',
  'STAGE_CHANGED'
);

CREATE TYPE "AppointmentWorkflowActionType" AS ENUM (
  'SEND_WHATSAPP',
  'SEND_EMAIL',
  'SEND_SMS',
  'SEND_PUSH',
  'SEND_WEBHOOK',
  'SCHEDULE_REMINDER',
  'UPDATE_CRM',
  'UPDATE_ANALYTICS',
  'ASSIGN_EMPLOYEE',
  'REQUEST_FEEDBACK',
  'GENERATE_SURVEY',
  'TRIGGER_MARKETING',
  'GENERATE_CALENDAR',
  'GENERATE_ICS',
  'GENERATE_QR',
  'AI_ANALYZE',
  'AI_SUGGEST_TIMES',
  'AI_PREDICT_NO_SHOW',
  'RELEASE_TIME_SLOT',
  'NOTIFY_EMPLOYEE',
  'CHANGE_STAGE'
);

CREATE TYPE "AppointmentTimelineActorType" AS ENUM (
  'SYSTEM',
  'USER',
  'AI',
  'CUSTOMER',
  'WEBHOOK'
);

ALTER TABLE "appointments"
  ADD COLUMN IF NOT EXISTS "workflowId" TEXT,
  ADD COLUMN IF NOT EXISTS "workflowStageId" TEXT,
  ADD COLUMN IF NOT EXISTS "workflowStageKey" TEXT,
  ADD COLUMN IF NOT EXISTS "bookingNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "qrCodeData" TEXT,
  ADD COLUMN IF NOT EXISTS "icsContent" TEXT,
  ADD COLUMN IF NOT EXISTS "calendarEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "primaryPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "secondaryPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "guardianPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "companyPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "primaryEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "secondaryEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "guardianEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "businessEmail" TEXT;

CREATE TABLE IF NOT EXISTS "appointment_workflows" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "templateKey" TEXT,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "appointment_workflows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "appointment_workflow_stages" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#651147',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "isTerminal" BOOLEAN NOT NULL DEFAULT false,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "defaultActions" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "appointment_workflow_stages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "appointment_workflow_transitions" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "fromStageId" TEXT NOT NULL,
  "toStageId" TEXT NOT NULL,
  "triggerEvent" "AppointmentWorkflowEventType" NOT NULL,
  "conditions" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "appointment_workflow_transitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "appointment_workflow_rules" (
  "id" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "triggerEvent" "AppointmentWorkflowEventType" NOT NULL,
  "conditions" JSONB NOT NULL DEFAULT '[]',
  "actions" JSONB NOT NULL DEFAULT '[]',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "appointment_workflow_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "appointment_workflow_templates" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "industry" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "definition" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "appointment_workflow_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "appointment_timeline_events" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorType" "AppointmentTimelineActorType" NOT NULL DEFAULT 'SYSTEM',
  "actorId" TEXT,
  "customerId" TEXT,
  "employeeId" TEXT,
  "channel" TEXT,
  "status" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointment_timeline_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "appointment_workflow_executions" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "triggerEvent" TEXT NOT NULL,
  "executedActions" JSONB NOT NULL DEFAULT '[]',
  "notificationStatus" JSONB,
  "deliveryStatus" JSONB,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "executionTimeMs" INTEGER,
  "errors" JSONB,
  "warnings" JSONB,
  "operatorId" TEXT,
  "ipAddress" TEXT,
  "device" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointment_workflow_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "appointment_reminder_configs" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "workflowId" TEXT,
  "label" TEXT NOT NULL,
  "offsetMinutes" INTEGER NOT NULL,
  "channels" TEXT[] DEFAULT ARRAY['WHATSAPP', 'EMAIL']::TEXT[],
  "template" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "appointment_reminder_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "appointment_automation_settings" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "activeWorkflowId" TEXT,
  "workingHours" JSONB,
  "holidays" JSONB,
  "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
  "defaultDuration" INTEGER NOT NULL DEFAULT 30,
  "bookingRules" JSONB,
  "cancellationRules" JSONB,
  "rescheduleRules" JSONB,
  "assignmentRules" JSONB,
  "aiRules" JSONB,
  "calendarSync" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "appointment_automation_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "appointment_analytics_snapshots" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "appointmentsCreated" INTEGER NOT NULL DEFAULT 0,
  "appointmentsConfirmed" INTEGER NOT NULL DEFAULT 0,
  "appointmentsCancelled" INTEGER NOT NULL DEFAULT 0,
  "appointmentsCompleted" INTEGER NOT NULL DEFAULT 0,
  "appointmentsRescheduled" INTEGER NOT NULL DEFAULT 0,
  "noShows" INTEGER NOT NULL DEFAULT 0,
  "avgDurationMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avgBookingTimeMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avgConfirmationMinutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reminderSuccessRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notificationSuccessRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "emailDeliveryRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "whatsappDeliveryRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "attendanceRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "customerSatisfaction" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "revenueGenerated" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "followUpSuccessRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "workflowSuccessRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "automationSuccessRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "appointment_analytics_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "appointment_workflow_stages_workflowId_key_key"
  ON "appointment_workflow_stages"("workflowId", "key");
CREATE UNIQUE INDEX IF NOT EXISTS "appointment_workflow_templates_key_key"
  ON "appointment_workflow_templates"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "appointment_automation_settings_businessId_key"
  ON "appointment_automation_settings"("businessId");
CREATE UNIQUE INDEX IF NOT EXISTS "appointment_analytics_snapshots_businessId_key"
  ON "appointment_analytics_snapshots"("businessId");

CREATE INDEX IF NOT EXISTS "appointment_workflows_businessId_idx" ON "appointment_workflows"("businessId");
CREATE INDEX IF NOT EXISTS "appointment_workflow_stages_workflowId_sortOrder_idx" ON "appointment_workflow_stages"("workflowId", "sortOrder");
CREATE INDEX IF NOT EXISTS "appointment_timeline_events_appointmentId_createdAt_idx" ON "appointment_timeline_events"("appointmentId", "createdAt");
CREATE INDEX IF NOT EXISTS "appointments_businessId_workflowStageKey_idx" ON "appointments"("businessId", "workflowStageKey");
CREATE INDEX IF NOT EXISTS "appointments_businessId_bookingNumber_idx" ON "appointments"("businessId", "bookingNumber");

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "appointment_workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_workflowStageId_fkey"
  FOREIGN KEY ("workflowStageId") REFERENCES "appointment_workflow_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "appointment_workflows"
  ADD CONSTRAINT "appointment_workflows_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointment_workflow_stages"
  ADD CONSTRAINT "appointment_workflow_stages_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "appointment_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointment_workflow_transitions"
  ADD CONSTRAINT "appointment_workflow_transitions_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "appointment_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointment_workflow_transitions"
  ADD CONSTRAINT "appointment_workflow_transitions_fromStageId_fkey"
  FOREIGN KEY ("fromStageId") REFERENCES "appointment_workflow_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointment_workflow_transitions"
  ADD CONSTRAINT "appointment_workflow_transitions_toStageId_fkey"
  FOREIGN KEY ("toStageId") REFERENCES "appointment_workflow_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointment_workflow_rules"
  ADD CONSTRAINT "appointment_workflow_rules_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "appointment_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointment_timeline_events"
  ADD CONSTRAINT "appointment_timeline_events_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointment_timeline_events"
  ADD CONSTRAINT "appointment_timeline_events_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointment_workflow_executions"
  ADD CONSTRAINT "appointment_workflow_executions_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointment_workflow_executions"
  ADD CONSTRAINT "appointment_workflow_executions_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "appointment_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointment_workflow_executions"
  ADD CONSTRAINT "appointment_workflow_executions_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointment_reminder_configs"
  ADD CONSTRAINT "appointment_reminder_configs_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointment_reminder_configs"
  ADD CONSTRAINT "appointment_reminder_configs_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "appointment_workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "appointment_automation_settings"
  ADD CONSTRAINT "appointment_automation_settings_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointment_analytics_snapshots"
  ADD CONSTRAINT "appointment_analytics_snapshots_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
