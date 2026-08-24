-- AlterTable Offer
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "isNoPriceConcept" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "campaignStrategy" JSONB;
ALTER TABLE "Offer" ADD COLUMN IF NOT EXISTS "campaignPhases" JSONB;

-- AlterTable NavigationOffer
ALTER TABLE "NavigationOffer" ADD COLUMN IF NOT EXISTS "graphicArtworkUrl" TEXT;
ALTER TABLE "NavigationOffer" ADD COLUMN IF NOT EXISTS "includeGraphicProof" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NavigationOffer" ADD COLUMN IF NOT EXISTS "clientArtworkUrl" TEXT;
ALTER TABLE "NavigationOffer" ADD COLUMN IF NOT EXISTS "clientArtworkFileName" TEXT;

-- AlterTable NavigationPoint
ALTER TABLE "NavigationPoint" ADD COLUMN IF NOT EXISTS "framePrice" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "NavigationPoint" ADD COLUMN IF NOT EXISTS "visualizedPhotoUrl" TEXT;
ALTER TABLE "NavigationPoint" ADD COLUMN IF NOT EXISTS "isSelectedByClient" BOOLEAN NOT NULL DEFAULT true;
