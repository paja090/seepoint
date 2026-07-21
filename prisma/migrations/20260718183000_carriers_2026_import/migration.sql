ALTER TABLE "ImportBatch"
  ADD COLUMN "fileHash" TEXT,
  ADD COLUMN "reportPath" TEXT,
  ADD COLUMN "environment" TEXT;

ALTER TABLE "Occupancy"
  ADD COLUMN "brandName" TEXT,
  ADD COLUMN "externalOrderReference" TEXT,
  ADD COLUMN "rawSourceText" TEXT,
  ADD COLUMN "sourceSystem" TEXT,
  ADD COLUMN "sourceSheet" TEXT,
  ADD COLUMN "sourceRow" INTEGER,
  ADD COLUMN "sourceKey" TEXT,
  ADD COLUMN "importBatchId" TEXT;

CREATE UNIQUE INDEX "Occupancy_sourceKey_key" ON "Occupancy"("sourceKey");
CREATE INDEX "Occupancy_importBatchId_idx" ON "Occupancy"("importBatchId");
CREATE INDEX "ImportBatch_fileHash_idx" ON "ImportBatch"("fileHash");

ALTER TABLE "Occupancy"
  ADD CONSTRAINT "Occupancy_importBatchId_fkey"
  FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PriceListItem" (
  "id" TEXT NOT NULL,
  "identityKey" TEXT NOT NULL,
  "versionKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "carrierType" "CarrierType",
  "mediaType" "MediaType",
  "rentalMonths" INTEGER NOT NULL DEFAULT 1,
  "minQuantity" INTEGER NOT NULL DEFAULT 1,
  "rentalPrice" DECIMAL(12,2) NOT NULL,
  "productionPrice" DECIMAL(12,2) NOT NULL,
  "totalPrice" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CZK',
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sourceSheet" TEXT,
  "sourceRow" INTEGER,
  "importBatchId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PriceListItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PriceListItem_versionKey_key" ON "PriceListItem"("versionKey");
CREATE INDEX "PriceListItem_identityKey_validFrom_validTo_idx" ON "PriceListItem"("identityKey", "validFrom", "validTo");
CREATE INDEX "PriceListItem_isActive_idx" ON "PriceListItem"("isActive");
CREATE INDEX "PriceListItem_importBatchId_idx" ON "PriceListItem"("importBatchId");

ALTER TABLE "PriceListItem"
  ADD CONSTRAINT "PriceListItem_importBatchId_fkey"
  FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
