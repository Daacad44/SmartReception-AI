-- Enterprise Subscription V2 (part 1) — enum values must commit before use in part 2

ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'CUSTOM';
ALTER TYPE "BusinessLicenseStatus" ADD VALUE IF NOT EXISTS 'LOCKED';
ALTER TYPE "SubscriptionDurationPreset" ADD VALUE IF NOT EXISTS 'DAYS_7';
ALTER TYPE "SubscriptionDurationPreset" ADD VALUE IF NOT EXISTS 'DAYS_14';
ALTER TYPE "SubscriptionDurationPreset" ADD VALUE IF NOT EXISTS 'DAYS_60';
ALTER TYPE "SubscriptionActivityAction" ADD VALUE IF NOT EXISTS 'LOCKED';
ALTER TYPE "SubscriptionActivityAction" ADD VALUE IF NOT EXISTS 'EDITED';
ALTER TYPE "SubscriptionNotificationType" ADD VALUE IF NOT EXISTS 'REMINDER_5D';
ALTER TYPE "SubscriptionPaymentStatus" ADD VALUE IF NOT EXISTS 'MANUAL';
ALTER TYPE "SubscriptionPaymentStatus" ADD VALUE IF NOT EXISTS 'COMPLIMENTARY';
ALTER TYPE "SubscriptionPaymentStatus" ADD VALUE IF NOT EXISTS 'LOCAL_PAYMENT_PENDING';

DO $$ BEGIN
  CREATE TYPE "SubscriptionPaymentMethod" AS ENUM ('CASH', 'EVC_PLUS', 'ZAAD', 'EDAHAB', 'PREMIER_WALLET', 'BANK', 'MANUAL', 'STRIPE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionTransactionType" AS ENUM ('PAYMENT', 'REFUND', 'ADJUSTMENT', 'RENEWAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "SubscriptionNotificationChannel" ADD VALUE IF NOT EXISTS 'IN_APP';
