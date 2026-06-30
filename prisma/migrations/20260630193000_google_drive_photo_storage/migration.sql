-- AlterTable
ALTER TABLE "Photo"
ADD COLUMN "driveFileId" TEXT,
ADD COLUMN "fileName" TEXT,
ADD COLUMN "mimeType" TEXT,
ADD COLUMN "size" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Photo_driveFileId_key" ON "Photo"("driveFileId");
