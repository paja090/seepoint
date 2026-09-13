-- 1. Add OCCUPANCY_INTELLIGENCE to AIFeatureType enum
DO $$ BEGIN
  ALTER TYPE "AIFeatureType" ADD VALUE IF NOT EXISTS 'OCCUPANCY_INTELLIGENCE';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create OccupancyInsightType enum
DO $$ BEGIN
  CREATE TYPE "OccupancyInsightType" AS ENUM (
    'DOUBLE_BOOKING',
    'STATUS_MISMATCH',
    'EXPIRED_OCCUPANCY',
    'OFFER_CONFLICT',
    'EXPIRING_CAMPAIGN',
    'UNDERUTILIZED_MEDIA',
    'CALENDAR_GAP',
    'MISSING_DATA'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Create OccupancyInsightSeverity enum
DO $$ BEGIN
  CREATE TYPE "OccupancyInsightSeverity" AS ENUM (
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW',
    'INFO'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Create OccupancyInsightStatus enum
DO $$ BEGIN
  CREATE TYPE "OccupancyInsightStatus" AS ENUM (
    'OPEN',
    'REVIEWED',
    'RESOLVED',
    'IGNORED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 5. Create OrganizationOccupancyAIProfile table
CREATE TABLE IF NOT EXISTS "OrganizationOccupancyAIProfile" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "automaticChecksEnabled" BOOLEAN NOT NULL DEFAULT true,
  "checkFrequency" TEXT NOT NULL DEFAULT 'DAILY',
  "checkReservationConflicts" BOOLEAN NOT NULL DEFAULT true,
  "checkCampaignConflicts" BOOLEAN NOT NULL DEFAULT true,
  "checkStatusMismatch" BOOLEAN NOT NULL DEFAULT true,
  "checkOfferConflicts" BOOLEAN NOT NULL DEFAULT true,
  "checkExpiringCampaigns" BOOLEAN NOT NULL DEFAULT true,
  "checkUnderutilizedMedia" BOOLEAN NOT NULL DEFAULT true,
  "checkMissingData" BOOLEAN NOT NULL DEFAULT true,
  "checkCalendarGaps" BOOLEAN NOT NULL DEFAULT true,
  "reservationHoldDays" INTEGER NOT NULL DEFAULT 14,
  "expiringCampaignWarningDays" INTEGER NOT NULL DEFAULT 14,
  "underutilizedAfterDays" INTEGER NOT NULL DEFAULT 60,
  "calendarGapMaxDays" INTEGER NOT NULL DEFAULT 21,
  "offerConflictMode" TEXT NOT NULL DEFAULT 'SENT_AND_ACCEPTED',
  "targetRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "targetCities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "preferredMediaTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastCheckAt" TIMESTAMP(3),

  CONSTRAINT "OrganizationOccupancyAIProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationOccupancyAIProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationOccupancyAIProfile_organizationId_key"
  ON "OrganizationOccupancyAIProfile"("organizationId");

CREATE INDEX IF NOT EXISTS "OrganizationOccupancyAIProfile_organizationId_idx"
  ON "OrganizationOccupancyAIProfile"("organizationId");

-- 6. Create OccupancyInsight table
CREATE TABLE IF NOT EXISTS "OccupancyInsight" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL DEFAULT current_setting('app.current_organization_id'::text, true),
  "type" "OccupancyInsightType" NOT NULL,
  "severity" "OccupancyInsightSeverity" NOT NULL,
  "status" "OccupancyInsightStatus" NOT NULL DEFAULT 'OPEN',
  "fingerprint" TEXT NOT NULL,
  "surfaceId" TEXT,
  "carrierId" TEXT,
  "occupancyId" TEXT,
  "offerId" TEXT,
  "clientId" TEXT,
  "title" TEXT NOT NULL,
  "deterministicReason" TEXT NOT NULL,
  "aiExplanation" TEXT,
  "aiRecommendation" TEXT,
  "suggestedActionType" TEXT,
  "metadata" JSONB,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OccupancyInsight_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OccupancyInsight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OccupancyInsight_surfaceId_fkey" FOREIGN KEY ("surfaceId") REFERENCES "AdvertisingSurface"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OccupancyInsight_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "AdvertisingCarrier"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OccupancyInsight_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OccupancyInsight_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OccupancyInsight_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "OccupancyInsight_organizationId_fingerprint_key"
  ON "OccupancyInsight"("organizationId", "fingerprint");

CREATE INDEX IF NOT EXISTS "OccupancyInsight_organizationId_status_idx"
  ON "OccupancyInsight"("organizationId", "status");

CREATE INDEX IF NOT EXISTS "OccupancyInsight_organizationId_type_idx"
  ON "OccupancyInsight"("organizationId", "type");

CREATE INDEX IF NOT EXISTS "OccupancyInsight_surfaceId_idx"
  ON "OccupancyInsight"("surfaceId");

CREATE INDEX IF NOT EXISTS "OccupancyInsight_detectedAt_idx"
  ON "OccupancyInsight"("detectedAt");
