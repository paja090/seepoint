ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'WORKER';

ALTER TYPE "OccupancyStatus" RENAME TO "OccupancyStatus_old";
CREATE TYPE "OccupancyStatus" AS ENUM ('AVAILABLE', 'NEGOTIATION', 'RESERVED', 'OCCUPIED', 'FINISHED', 'CANCELLED', 'OUT_OF_SERVICE');
ALTER TABLE "Occupancy" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Occupancy"
  ALTER COLUMN "status" TYPE "OccupancyStatus"
  USING (
    CASE
      WHEN "status"::text = 'ACTIVE' THEN 'OCCUPIED'
      ELSE "status"::text
    END
  )::"OccupancyStatus";
ALTER TABLE "Occupancy" ALTER COLUMN "status" SET DEFAULT 'RESERVED';
DROP TYPE "OccupancyStatus_old";

CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

ALTER TABLE "Client"
  ADD COLUMN "companyId" TEXT,
  ADD COLUMN "contactPerson" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "phone" TEXT;

ALTER TABLE "Occupancy"
  ADD COLUMN "createdBy" TEXT,
  ADD COLUMN "updatedBy" TEXT,
  ADD COLUMN "reservedUntil" TIMESTAMP(3),
  ADD COLUMN "offerId" TEXT;

CREATE TABLE "Offer" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
  "validUntil" TIMESTAMP(3),
  "note" TEXT,
  "totalPrice" DECIMAL(12,2),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfferItem" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "surfaceId" TEXT NOT NULL,
  "dateFrom" TIMESTAMP(3) NOT NULL,
  "dateTo" TIMESTAMP(3) NOT NULL,
  "price" DECIMAL(12,2),
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfferItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Occupancy_offerId_idx" ON "Occupancy"("offerId");
CREATE INDEX "Occupancy_status_dateFrom_dateTo_idx" ON "Occupancy"("status", "dateFrom", "dateTo");
CREATE INDEX "Offer_clientId_idx" ON "Offer"("clientId");
CREATE INDEX "Offer_status_validUntil_idx" ON "Offer"("status", "validUntil");
CREATE INDEX "OfferItem_offerId_idx" ON "OfferItem"("offerId");
CREATE INDEX "OfferItem_surfaceId_idx" ON "OfferItem"("surfaceId");
CREATE INDEX "OfferItem_dateFrom_dateTo_idx" ON "OfferItem"("dateFrom", "dateTo");

ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_surfaceId_fkey" FOREIGN KEY ("surfaceId") REFERENCES "AdvertisingSurface"("id") ON DELETE CASCADE ON UPDATE CASCADE;
