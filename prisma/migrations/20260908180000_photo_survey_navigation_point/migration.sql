-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "surveyNavigationPointId" TEXT;

-- CreateIndex
CREATE INDEX "Photo_surveyNavigationPointId_idx" ON "Photo"("surveyNavigationPointId");

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_surveyNavigationPointId_fkey" FOREIGN KEY ("surveyNavigationPointId") REFERENCES "NavigationPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
