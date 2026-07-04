-- Business Profile module (independent from Knowledge Base)

CREATE TYPE "BusinessProfileExtractionStatus" AS ENUM ('NONE', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE IF NOT EXISTS "business_profiles" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "businessName" TEXT,
    "logoUrl" TEXT,
    "businessCategory" TEXT,
    "industryLabel" TEXT,
    "companyOverview" TEXT,
    "aboutUs" TEXT,
    "mission" TEXT,
    "vision" TEXT,
    "coreValues" JSONB,
    "businessDescription" TEXT,
    "founder" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "address" TEXT,
    "country" TEXT,
    "city" TEXT,
    "workingHours" TEXT,
    "googleMapsUrl" TEXT,
    "socialMedia" JSONB,
    "yearsInBusiness" INTEGER,
    "certifications" JSONB,
    "awards" JSONB,
    "brandTone" TEXT,
    "languages" JSONB,
    "callToAction" TEXT,
    "whyChooseUs" TEXT,
    "companyIntroduction" TEXT,
    "companySummary" TEXT,
    "shortIntroduction" TEXT,
    "longIntroduction" TEXT,
    "profilePdfUrl" TEXT,
    "profilePdfFilename" TEXT,
    "extractionStatus" "BusinessProfileExtractionStatus" NOT NULL DEFAULT 'NONE',
    "extractionError" TEXT,
    "extractedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "business_profiles_businessId_key" ON "business_profiles"("businessId");
CREATE INDEX IF NOT EXISTS "business_profiles_businessId_idx" ON "business_profiles"("businessId");

ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
