CREATE TYPE "GpsStatus" AS ENUM ('MISSING', 'UNVERIFIED', 'VERIFIED');
CREATE TYPE "MountingType" AS ENUM ('LIGHT_POLE', 'POLE', 'COLUMN', 'TRACTION', 'OTHER', 'UNKNOWN');
CREATE TYPE "MediaType" AS ENUM ('NAVIGATION_SIGN', 'BILLBOARD', 'BIGBOARD', 'CITYLIGHT', 'BANNER', 'FACADE', 'LED_SCREEN', 'OTHER');
CREATE TYPE "ImportStatus" AS ENUM ('DRAFT', 'VALIDATED', 'IMPORTED', 'FAILED');

CREATE TABLE "Client" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "externalCode" TEXT,
  "note" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportBatch" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'DRAFT',
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "validRows" INTEGER NOT NULL DEFAULT 0,
  "importedRows" INTEGER NOT NULL DEFAULT 0,
  "skippedRows" INTEGER NOT NULL DEFAULT 0,
  "errorRows" INTEGER NOT NULL DEFAULT 0,
  "mapping" JSONB,
  "createdById" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AdvertisingCarrier"
  ALTER COLUMN "latitude" DROP NOT NULL,
  ALTER COLUMN "longitude" DROP NOT NULL,
  ADD COLUMN "gpsStatus" "GpsStatus" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "cadastralArea" TEXT,
  ADD COLUMN "structureCode" TEXT,
  ADD COLUMN "mountingType" "MountingType" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "sourceSystem" TEXT,
  ADD COLUMN "sourceSheet" TEXT,
  ADD COLUMN "sourceRow" INTEGER,
  ADD COLUMN "sourceKey" TEXT,
  ADD COLUMN "importBatchId" TEXT;

ALTER TABLE "AdvertisingSurface"
  ADD COLUMN "currentClientId" TEXT,
  ADD COLUMN "importBatchId" TEXT,
  ADD COLUMN "mediaType" "MediaType" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "sourcePosition" TEXT,
  ADD COLUMN "directionDescription" TEXT,
  ADD COLUMN "rawMediaType" TEXT,
  ADD COLUMN "sourceKey" TEXT;

ALTER TABLE "Occupancy"
  ADD COLUMN "clientId" TEXT;

CREATE TABLE "ImportRowError" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "sheetName" TEXT,
  "field" TEXT,
  "code" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "rawData" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportRowError_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Client_normalizedName_key" ON "Client"("normalizedName");
CREATE UNIQUE INDEX "Client_externalCode_key" ON "Client"("externalCode");
CREATE UNIQUE INDEX "AdvertisingCarrier_sourceKey_key" ON "AdvertisingCarrier"("sourceKey");
CREATE UNIQUE INDEX "AdvertisingSurface_sourceKey_key" ON "AdvertisingSurface"("sourceKey");
CREATE INDEX "AdvertisingCarrier_importBatchId_idx" ON "AdvertisingCarrier"("importBatchId");
CREATE INDEX "AdvertisingCarrier_city_structureCode_idx" ON "AdvertisingCarrier"("city", "structureCode");
CREATE INDEX "AdvertisingCarrier_latitude_longitude_idx" ON "AdvertisingCarrier"("latitude", "longitude");
CREATE INDEX "AdvertisingSurface_currentClientId_idx" ON "AdvertisingSurface"("currentClientId");
CREATE INDEX "AdvertisingSurface_importBatchId_idx" ON "AdvertisingSurface"("importBatchId");
CREATE INDEX "AdvertisingSurface_mediaType_status_idx" ON "AdvertisingSurface"("mediaType", "status");
CREATE INDEX "Occupancy_clientId_idx" ON "Occupancy"("clientId");
CREATE INDEX "ImportBatch_createdById_idx" ON "ImportBatch"("createdById");
CREATE INDEX "ImportBatch_status_createdAt_idx" ON "ImportBatch"("status", "createdAt");
CREATE INDEX "ImportRowError_batchId_rowNumber_idx" ON "ImportRowError"("batchId", "rowNumber");

ALTER TABLE "AdvertisingCarrier" ADD CONSTRAINT "AdvertisingCarrier_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvertisingSurface" ADD CONSTRAINT "AdvertisingSurface_currentClientId_fkey" FOREIGN KEY ("currentClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvertisingSurface" ADD CONSTRAINT "AdvertisingSurface_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImportRowError" ADD CONSTRAINT "ImportRowError_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
