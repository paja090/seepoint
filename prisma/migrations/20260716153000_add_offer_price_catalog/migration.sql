-- Configurable sales pricing catalog and immutable pricing snapshots for offers.
-- Additive only: no existing tables, columns, or data are removed or rewritten.
CREATE TYPE "OfferPriceCategory" AS ENUM ('RENTAL', 'PRODUCTION', 'SERVICE');
CREATE TYPE "OfferPriceCalculation" AS ENUM ('PER_SURFACE', 'FLAT');

CREATE TABLE "OfferPriceRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "OfferPriceCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "mediaType" "MediaType",
    "calculation" "OfferPriceCalculation" NOT NULL DEFAULT 'PER_SURFACE',
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "defaultSelected" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OfferPriceRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OfferCharge" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "priceRuleId" TEXT,
    "category" "OfferPriceCategory" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OfferCharge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OfferPriceRule_code_key" ON "OfferPriceRule"("code");
CREATE INDEX "OfferPriceRule_category_active_sortOrder_idx" ON "OfferPriceRule"("category", "active", "sortOrder");
CREATE INDEX "OfferPriceRule_mediaType_active_idx" ON "OfferPriceRule"("mediaType", "active");
CREATE INDEX "OfferCharge_offerId_sortOrder_idx" ON "OfferCharge"("offerId", "sortOrder");
CREATE INDEX "OfferCharge_priceRuleId_idx" ON "OfferCharge"("priceRuleId");

ALTER TABLE "OfferPriceRule" ADD CONSTRAINT "OfferPriceRule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfferPriceRule" ADD CONSTRAINT "OfferPriceRule_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfferCharge" ADD CONSTRAINT "OfferCharge_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OfferCharge" ADD CONSTRAINT "OfferCharge_priceRuleId_fkey" FOREIGN KEY ("priceRuleId") REFERENCES "OfferPriceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
