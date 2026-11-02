-- Drop unique index on Client.logoDriveFileId to allow base64 fallback and shared client logos without btree size limit
DROP INDEX IF EXISTS "Client_logoDriveFileId_key";
