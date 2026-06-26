-- Employee Communication Center

CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED');
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'TEMPORARY');
CREATE TYPE "EmployeeBroadcastType" AS ENUM ('ANNOUNCEMENT', 'NOTIFICATION', 'EMERGENCY', 'MEETING', 'HOLIDAY', 'POLICY', 'TRAINING', 'MOTIVATION', 'PAYROLL', 'SHIFT', 'CUSTOM');
CREATE TYPE "EmployeeBroadcastSchedule" AS ENUM ('ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'RECURRING');
CREATE TYPE "EmployeeBroadcastStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED', 'ARCHIVED');
CREATE TYPE "EmployeeDeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

CREATE TABLE IF NOT EXISTS "employees" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeeCode" TEXT,
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "role" TEXT,
    "phone" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "email" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "profilePhotoUrl" TEXT,
    "branch" TEXT,
    "managerId" TEXT,
    "hireDate" TIMESTAMP(3),
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "permissions" JSONB,
    "language" TEXT NOT NULL DEFAULT 'so',
    "timezone" TEXT,
    "lastActiveAt" TIMESTAMP(3),
    "userId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_groups" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#651147',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_groups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_group_members" (
    "employeeId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_group_members_pkey" PRIMARY KEY ("employeeId","groupId")
);

CREATE TABLE IF NOT EXISTS "employee_templates" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_broadcasts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "EmployeeBroadcastType" NOT NULL DEFAULT 'ANNOUNCEMENT',
    "schedule" "EmployeeBroadcastSchedule" NOT NULL DEFAULT 'ONE_TIME',
    "status" "EmployeeBroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "messageType" "CampaignMessageType" NOT NULL DEFAULT 'TEXT',
    "groupId" TEXT,
    "department" TEXT,
    "branch" TEXT,
    "employeeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sendToAll" BOOLEAN NOT NULL DEFAULT false,
    "templateId" TEXT,
    "mediaUrl" TEXT,
    "mediaFilename" TEXT,
    "timezone" TEXT,
    "cronExpression" TEXT,
    "scheduleConfig" JSONB,
    "repeatCount" INTEGER,
    "repeatUntil" TIMESTAMP(3),
    "runsCompleted" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_broadcasts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_broadcast_recipients" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "EmployeeDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "runVersion" INTEGER NOT NULL DEFAULT 0,
    "whatsappMsgId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "failedReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_broadcast_recipients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_conversations" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "whatsappAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_conversation_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "mediaUrl" TEXT,
    "mediaFilename" TEXT,
    "whatsappMsgId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employees_businessId_phone_key" ON "employees"("businessId", "phone");
CREATE INDEX IF NOT EXISTS "employees_businessId_idx" ON "employees"("businessId");
CREATE INDEX IF NOT EXISTS "employees_businessId_status_idx" ON "employees"("businessId", "status");
CREATE INDEX IF NOT EXISTS "employees_businessId_department_idx" ON "employees"("businessId", "department");
CREATE INDEX IF NOT EXISTS "employees_businessId_branch_idx" ON "employees"("businessId", "branch");
CREATE INDEX IF NOT EXISTS "employees_businessId_fullName_idx" ON "employees"("businessId", "fullName");
CREATE INDEX IF NOT EXISTS "employees_businessId_email_idx" ON "employees"("businessId", "email");

CREATE UNIQUE INDEX IF NOT EXISTS "employee_groups_businessId_name_key" ON "employee_groups"("businessId", "name");
CREATE INDEX IF NOT EXISTS "employee_groups_businessId_idx" ON "employee_groups"("businessId");

CREATE INDEX IF NOT EXISTS "employee_group_members_groupId_idx" ON "employee_group_members"("groupId");

CREATE UNIQUE INDEX IF NOT EXISTS "employee_templates_businessId_name_key" ON "employee_templates"("businessId", "name");
CREATE INDEX IF NOT EXISTS "employee_templates_businessId_idx" ON "employee_templates"("businessId");
CREATE INDEX IF NOT EXISTS "employee_templates_businessId_category_idx" ON "employee_templates"("businessId", "category");

CREATE INDEX IF NOT EXISTS "employee_broadcasts_businessId_idx" ON "employee_broadcasts"("businessId");
CREATE INDEX IF NOT EXISTS "employee_broadcasts_businessId_status_idx" ON "employee_broadcasts"("businessId", "status");
CREATE INDEX IF NOT EXISTS "employee_broadcasts_scheduledAt_idx" ON "employee_broadcasts"("scheduledAt");
CREATE INDEX IF NOT EXISTS "employee_broadcasts_nextRunAt_idx" ON "employee_broadcasts"("nextRunAt");

CREATE UNIQUE INDEX IF NOT EXISTS "employee_broadcast_recipients_broadcastId_employeeId_key" ON "employee_broadcast_recipients"("broadcastId", "employeeId");
CREATE INDEX IF NOT EXISTS "employee_broadcast_recipients_broadcastId_idx" ON "employee_broadcast_recipients"("broadcastId");
CREATE INDEX IF NOT EXISTS "employee_broadcast_recipients_employeeId_idx" ON "employee_broadcast_recipients"("employeeId");
CREATE INDEX IF NOT EXISTS "employee_broadcast_recipients_status_idx" ON "employee_broadcast_recipients"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "employee_conversations_businessId_employeeId_key" ON "employee_conversations"("businessId", "employeeId");
CREATE INDEX IF NOT EXISTS "employee_conversations_businessId_status_idx" ON "employee_conversations"("businessId", "status");
CREATE INDEX IF NOT EXISTS "employee_conversations_businessId_lastMessageAt_idx" ON "employee_conversations"("businessId", "lastMessageAt");

CREATE INDEX IF NOT EXISTS "employee_conversation_messages_conversationId_idx" ON "employee_conversation_messages"("conversationId");
CREATE INDEX IF NOT EXISTS "employee_conversation_messages_whatsappMsgId_idx" ON "employee_conversation_messages"("whatsappMsgId");

ALTER TABLE "employees" ADD CONSTRAINT "employees_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employee_groups" ADD CONSTRAINT "employee_groups_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_group_members" ADD CONSTRAINT "employee_group_members_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_group_members" ADD CONSTRAINT "employee_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "employee_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_templates" ADD CONSTRAINT "employee_templates_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_broadcasts" ADD CONSTRAINT "employee_broadcasts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_broadcasts" ADD CONSTRAINT "employee_broadcasts_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "employee_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employee_broadcasts" ADD CONSTRAINT "employee_broadcasts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "employee_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employee_broadcasts" ADD CONSTRAINT "employee_broadcasts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employee_broadcast_recipients" ADD CONSTRAINT "employee_broadcast_recipients_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "employee_broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_broadcast_recipients" ADD CONSTRAINT "employee_broadcast_recipients_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_conversations" ADD CONSTRAINT "employee_conversations_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_conversations" ADD CONSTRAINT "employee_conversations_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_conversation_messages" ADD CONSTRAINT "employee_conversation_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "employee_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
