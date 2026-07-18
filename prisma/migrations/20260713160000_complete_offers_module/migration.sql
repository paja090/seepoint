-- Complete offers module: additive columns, audit events, ownership and idempotent conversion.
CREATE TYPE "OfferEventType" AS ENUM (
  'CREATED', 'UPDATED', 'DUPLICATED', 'PUBLISHED', 'SENT', 'ACCEPTED',
  'REJECTED', 'EXPIRED', 'QUESTION', 'CONVERTED', 'ARCHIVED'
);

ALTER TABLE "Offer"
  ADD COLUMN "campaignName" TEXT,
  ADD COLUMN "contactPerson" TEXT,
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "campaignGoal" TEXT,
  ADD COLUMN "budget" DECIMAL(12,2),
  ADD COLUMN "internalNote" TEXT,
  ADD COLUMN "clientMessage" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'CZK',
  ADD COLUMN "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 21,
  ADD COLUMN "subtotal" DECIMAL(12,2),
  ADD COLUMN "discountAmount" DECIMAL(12,2),
  ADD COLUMN "taxAmount" DECIMAL(12,2),
  ADD COLUMN "totalWithTax" DECIMAL(12,2),
  ADD COLUMN "publicTokenHash" TEXT,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "acceptedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "expiredAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "negotiationApprovedAt" TIMESTAMP(3),
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "updatedByUserId" TEXT;

ALTER TABLE "OfferItem"
  ADD COLUMN "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
  ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'plocha',
  ADD COLUMN "unitPrice" DECIMAL(12,2),
  ADD COLUMN "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "subtotal" DECIMAL(12,2),
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "groupLabel" TEXT,
  ADD COLUMN "customTitle" TEXT,
  ADD COLUMN "clientDescription" TEXT;

CREATE TABLE "OfferEvent" (
  "id" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "type" "OfferEventType" NOT NULL,
  "fromStatus" "OfferStatus",
  "toStatus" "OfferStatus",
  "actorUserId" TEXT,
  "actorName" TEXT,
  "actorEmail" TEXT,
  "message" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfferEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Offer_publicTokenHash_key" ON "Offer"("publicTokenHash");
CREATE INDEX "Offer_createdByUserId_createdAt_idx" ON "Offer"("createdByUserId", "createdAt");
CREATE INDEX "Offer_archivedAt_idx" ON "Offer"("archivedAt");
CREATE UNIQUE INDEX "Occupancy_offerId_surfaceId_key" ON "Occupancy"("offerId", "surfaceId");
CREATE INDEX "OfferEvent_offerId_createdAt_idx" ON "OfferEvent"("offerId", "createdAt");
CREATE INDEX "OfferEvent_actorUserId_idx" ON "OfferEvent"("actorUserId");

ALTER TABLE "Offer" ADD CONSTRAINT "Offer_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfferEvent" ADD CONSTRAINT "OfferEvent_offerId_fkey"
  FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferEvent" ADD CONSTRAINT "OfferEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep historical offers when a client is removed; deletion is rejected while referenced.
ALTER TABLE "Offer" DROP CONSTRAINT IF EXISTS "Offer_clientId_fkey";
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
