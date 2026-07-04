-- Business type catalog table + business category on businesses
CREATE TABLE IF NOT EXISTS "business_type_definitions" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "icon" TEXT NOT NULL DEFAULT '📋',
  "category" TEXT NOT NULL,
  "industry" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_type_definitions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "business_type_definitions_category_idx" ON "business_type_definitions"("category");
CREATE INDEX IF NOT EXISTS "business_type_definitions_isActive_idx" ON "business_type_definitions"("isActive");

ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "businessCategory" TEXT;
