ALTER TABLE "Client"
  ADD COLUMN "logoDriveFileId" TEXT,
  ADD COLUMN "logoFileName" TEXT,
  ADD COLUMN "logoMimeType" TEXT,
  ADD COLUMN "logoUpdatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Client_logoDriveFileId_key" ON "Client"("logoDriveFileId");
