ALTER TABLE "NavigationPoint" ADD COLUMN "sitePhotoId" TEXT;
CREATE UNIQUE INDEX "NavigationPoint_sitePhotoId_key" ON "NavigationPoint"("sitePhotoId");
ALTER TABLE "NavigationPoint" ADD CONSTRAINT "NavigationPoint_sitePhotoId_fkey"
  FOREIGN KEY ("sitePhotoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
