ALTER TABLE "Photo"
  ADD COLUMN IF NOT EXISTS "storageKey" TEXT,
  ADD COLUMN IF NOT EXISTS "webStorageKey" TEXT,
  ADD COLUMN IF NOT EXISTS "thumbnailStorageKey" TEXT,
  ADD COLUMN IF NOT EXISTS "contentChecksum" TEXT;

-- Preserve all historical sources. The canonical key only describes existing
-- ownership; no Drive or database payload is copied or deleted by this migration.
UPDATE "Photo"
SET "storageKey" = CASE
  WHEN "driveFileId" IS NOT NULL THEN 'google-drive/' || "driveFileId"
  WHEN "content" IS NOT NULL THEN 'database/' || "id"
  ELSE NULL
END
WHERE "storageKey" IS NULL;

UPDATE "Photo"
SET "storageProvider" = CASE
  WHEN "driveFileId" IS NOT NULL THEN 'GOOGLE_DRIVE'
  WHEN "content" IS NOT NULL THEN 'DATABASE'
  ELSE COALESCE(NULLIF("storageProvider", ''), 'EXTERNAL_URL')
END;

CREATE INDEX IF NOT EXISTS "Photo_organizationId_storageProvider_idx"
  ON "Photo"("organizationId", "storageProvider");
