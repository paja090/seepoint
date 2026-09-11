-- Offer and realization points retain the same survey photograph.
DROP INDEX "NavigationPoint_sitePhotoId_key";
CREATE INDEX "NavigationPoint_sitePhotoId_idx" ON "NavigationPoint"("sitePhotoId");
