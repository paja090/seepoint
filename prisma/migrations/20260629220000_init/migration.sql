CREATE TYPE "Role" AS ENUM ('ADMIN', 'SALES', 'TECHNICIAN', 'VIEWER');
CREATE TYPE "CarrierType" AS ENUM ('BILLBOARD', 'BIGBOARD', 'CITYLIGHT', 'BANNER', 'FACADE', 'LED_SCREEN', 'OTHER');
CREATE TYPE "CarrierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');
CREATE TYPE "SurfaceStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'NEGOTIATION', 'OUT_OF_SERVICE');
CREATE TYPE "OccupancyStatus" AS ENUM ('RESERVED', 'ACTIVE', 'FINISHED', 'CANCELLED');
CREATE TYPE "PhotoType" AS ENUM ('LOCATION', 'CARRIER', 'CAMPAIGN', 'INSTALLATION', 'CHECK', 'ARCHIVE');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdvertisingCarrier" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" "CarrierType" NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "address" TEXT,
  "city" TEXT NOT NULL,
  "region" TEXT,
  "status" "CarrierStatus" NOT NULL DEFAULT 'ACTIVE',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdvertisingCarrier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdvertisingSurface" (
  "id" TEXT NOT NULL,
  "carrierId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "size" TEXT,
  "orientation" TEXT,
  "status" "SurfaceStatus" NOT NULL DEFAULT 'AVAILABLE',
  "price" DECIMAL(12,2),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdvertisingSurface_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Occupancy" (
  "id" TEXT NOT NULL,
  "surfaceId" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "campaignName" TEXT NOT NULL,
  "dateFrom" TIMESTAMP(3) NOT NULL,
  "dateTo" TIMESTAMP(3) NOT NULL,
  "status" "OccupancyStatus" NOT NULL DEFAULT 'RESERVED',
  "price" DECIMAL(12,2),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Occupancy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Photo" (
  "id" TEXT NOT NULL,
  "carrierId" TEXT,
  "surfaceId" TEXT,
  "url" TEXT NOT NULL,
  "type" "PhotoType" NOT NULL DEFAULT 'CARRIER',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "AdvertisingCarrier_code_key" ON "AdvertisingCarrier"("code");
CREATE INDEX "AdvertisingSurface_carrierId_idx" ON "AdvertisingSurface"("carrierId");
CREATE INDEX "Occupancy_surfaceId_idx" ON "Occupancy"("surfaceId");
CREATE INDEX "Photo_carrierId_idx" ON "Photo"("carrierId");
CREATE INDEX "Photo_surfaceId_idx" ON "Photo"("surfaceId");

ALTER TABLE "AdvertisingSurface" ADD CONSTRAINT "AdvertisingSurface_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "AdvertisingCarrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_surfaceId_fkey" FOREIGN KEY ("surfaceId") REFERENCES "AdvertisingSurface"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "AdvertisingCarrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_surfaceId_fkey" FOREIGN KEY ("surfaceId") REFERENCES "AdvertisingSurface"("id") ON DELETE CASCADE ON UPDATE CASCADE;
