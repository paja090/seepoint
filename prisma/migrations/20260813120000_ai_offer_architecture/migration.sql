CREATE TYPE "ClientPricingSegment" AS ENUM ('COMMERCIAL', 'CULTURE_SPORT', 'PUBLIC_NONPROFIT', 'CUSTOM');

ALTER TABLE "Client" ADD COLUMN "pricingSegment" "ClientPricingSegment" NOT NULL DEFAULT 'COMMERCIAL';
ALTER TABLE "Offer" ADD COLUMN "pricingSegment" "ClientPricingSegment" NOT NULL DEFAULT 'COMMERCIAL';

ALTER TABLE "OfferPriceRule"
  ADD COLUMN "pricingSegment" "ClientPricingSegment" NOT NULL DEFAULT 'COMMERCIAL',
  ADD COLUMN "city" TEXT,
  ADD COLUMN "validFrom" TIMESTAMP(3),
  ADD COLUMN "validTo" TIMESTAMP(3),
  ADD COLUMN "minDurationMonths" INTEGER,
  ADD COLUMN "maxDurationMonths" INTEGER;

ALTER TABLE "OfferItem"
  ADD COLUMN "priceRuleId" TEXT,
  ADD COLUMN "pricingSegment" "ClientPricingSegment" NOT NULL DEFAULT 'COMMERCIAL',
  ADD COLUMN "catalogPrice" DECIMAL(12,2),
  ADD COLUMN "finalPrice" DECIMAL(12,2),
  ADD COLUMN "priceSource" TEXT,
  ADD COLUMN "priceValidFrom" TIMESTAMP(3),
  ADD COLUMN "priceValidTo" TIMESTAMP(3),
  ADD COLUMN "overrideReason" TEXT,
  ADD COLUMN "overrideByUserId" TEXT;

ALTER TABLE "NavigationPoint" ADD COLUMN "priceSnapshot" JSONB;

CREATE INDEX "OfferPriceRule_pricingSegment_mediaType_category_active_idx" ON "OfferPriceRule"("pricingSegment", "mediaType", "category", "active");
CREATE INDEX "OfferPriceRule_validFrom_validTo_idx" ON "OfferPriceRule"("validFrom", "validTo");
CREATE INDEX "OfferItem_priceRuleId_idx" ON "OfferItem"("priceRuleId");

ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_priceRuleId_fkey" FOREIGN KEY ("priceRuleId") REFERENCES "OfferPriceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_overrideByUserId_fkey" FOREIGN KEY ("overrideByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
