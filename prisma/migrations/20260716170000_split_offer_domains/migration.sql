-- Additive domain split. Existing offers remain STANDARD_MEDIA by database default.
CREATE TYPE "OfferType" AS ENUM ('STANDARD_MEDIA', 'NAVIGATION', 'CITY_GALLERY');
CREATE TYPE "NavigationPointStatus" AS ENUM ('PLANNED', 'APPROVAL_REQUIRED', 'APPROVED', 'TECHNICAL_CHECK', 'READY_FOR_INSTALLATION', 'INSTALLED', 'REMOVED', 'CANCELLED');
CREATE TYPE "CityGalleryProjectStatus" AS ENUM ('DRAFT', 'PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "MediaPackageSelectionMode" AS ENUM ('MANUAL', 'AUTOMATIC', 'HYBRID');

ALTER TABLE "Offer" ADD COLUMN "offerType" "OfferType" NOT NULL DEFAULT 'STANDARD_MEDIA';
ALTER TABLE "OfferItem" ADD COLUMN "packageSelectionId" TEXT;

CREATE TABLE "NavigationOffer" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "targetName" TEXT NOT NULL,
  "targetAddress" TEXT,
  "targetLatitude" DOUBLE PRECISION NOT NULL,
  "targetLongitude" DOUBLE PRECISION NOT NULL,
  "targetNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NavigationOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NavigationPoint" (
  "id" TEXT NOT NULL,
  "navigationOfferId" TEXT NOT NULL,
  "carrierId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "address" TEXT,
  "label" TEXT NOT NULL,
  "navigationType" TEXT NOT NULL,
  "variant" TEXT,
  "orientation" TEXT,
  "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "installationPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "removalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "productionPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "internalNote" TEXT,
  "clientNote" TEXT,
  "status" "NavigationPointStatus" NOT NULL DEFAULT 'PLANNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NavigationPoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CityGalleryProject" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "CityGalleryProjectStatus" NOT NULL DEFAULT 'DRAFT',
  "city" TEXT,
  "locality" TEXT,
  "address" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "description" TEXT,
  "dateFrom" TIMESTAMP(3),
  "dateTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CityGalleryProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CityGalleryOffer" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "projectId" TEXT,
  "concept" TEXT,
  "locationBrief" TEXT,
  "realizationNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CityGalleryOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaPackage" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "standardPrice" DECIMAL(12,2),
  "packagePrice" DECIMAL(12,2),
  "defaultDuration" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MediaPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaPackageRule" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "mediaType" "MediaType" NOT NULL,
  "city" TEXT,
  "locality" TEXT,
  "quantity" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaPackageRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfferPackageSelection" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "packageId" TEXT,
  "packageName" TEXT NOT NULL,
  "selectionMode" "MediaPackageSelectionMode" NOT NULL DEFAULT 'MANUAL',
  "standardPrice" DECIMAL(12,2),
  "packagePrice" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfferPackageSelection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NavigationOffer_offerId_key" ON "NavigationOffer"("offerId");
CREATE INDEX "NavigationOffer_targetLatitude_targetLongitude_idx" ON "NavigationOffer"("targetLatitude", "targetLongitude");
CREATE INDEX "NavigationPoint_navigationOfferId_sortOrder_idx" ON "NavigationPoint"("navigationOfferId", "sortOrder");
CREATE INDEX "NavigationPoint_carrierId_idx" ON "NavigationPoint"("carrierId");
CREATE INDEX "NavigationPoint_latitude_longitude_idx" ON "NavigationPoint"("latitude", "longitude");
CREATE INDEX "CityGalleryProject_status_city_idx" ON "CityGalleryProject"("status", "city");
CREATE UNIQUE INDEX "CityGalleryOffer_offerId_key" ON "CityGalleryOffer"("offerId");
CREATE INDEX "CityGalleryOffer_projectId_idx" ON "CityGalleryOffer"("projectId");
CREATE INDEX "MediaPackage_active_name_idx" ON "MediaPackage"("active", "name");
CREATE INDEX "MediaPackageRule_packageId_sortOrder_idx" ON "MediaPackageRule"("packageId", "sortOrder");
CREATE INDEX "MediaPackageRule_mediaType_city_idx" ON "MediaPackageRule"("mediaType", "city");
CREATE INDEX "OfferPackageSelection_offerId_idx" ON "OfferPackageSelection"("offerId");
CREATE INDEX "OfferPackageSelection_packageId_idx" ON "OfferPackageSelection"("packageId");
CREATE INDEX "OfferItem_packageSelectionId_idx" ON "OfferItem"("packageSelectionId");

ALTER TABLE "NavigationOffer" ADD CONSTRAINT "NavigationOffer_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NavigationPoint" ADD CONSTRAINT "NavigationPoint_navigationOfferId_fkey" FOREIGN KEY ("navigationOfferId") REFERENCES "NavigationOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NavigationPoint" ADD CONSTRAINT "NavigationPoint_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "AdvertisingCarrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CityGalleryOffer" ADD CONSTRAINT "CityGalleryOffer_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CityGalleryOffer" ADD CONSTRAINT "CityGalleryOffer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "CityGalleryProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MediaPackageRule" ADD CONSTRAINT "MediaPackageRule_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "MediaPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferPackageSelection" ADD CONSTRAINT "OfferPackageSelection_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferPackageSelection" ADD CONSTRAINT "OfferPackageSelection_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "MediaPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_packageSelectionId_fkey" FOREIGN KEY ("packageSelectionId") REFERENCES "OfferPackageSelection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
