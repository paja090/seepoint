UPDATE "Photo"
SET "storageProvider" = 'DATABASE',
    "storageKey" = COALESCE("storageKey", 'database/' || "id")
WHERE "url" LIKE 'data:%'
  AND "driveFileId" IS NULL
  AND "content" IS NULL;
