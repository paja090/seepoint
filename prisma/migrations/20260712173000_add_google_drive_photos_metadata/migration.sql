-- DropIndex
DROP INDEX IF EXISTS "Photo_driveFileId_key";

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Photo" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Photo" ADD COLUMN "isClientVisible" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Photo_carrierId_driveFileId_key" ON "Photo"("carrierId", "driveFileId");

-- CreateIndex
CREATE INDEX "Photo_carrierId_sortOrder_idx" ON "Photo"("carrierId", "sortOrder");
