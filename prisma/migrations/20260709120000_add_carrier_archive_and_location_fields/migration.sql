ALTER TABLE "AdvertisingCarrier"
  ADD COLUMN "street" TEXT,
  ADD COLUMN "locality" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "placementDescription" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedBy" TEXT,
  ADD COLUMN "archiveReason" TEXT;

CREATE INDEX "AdvertisingCarrier_archivedAt_idx" ON "AdvertisingCarrier"("archivedAt");
