-- Durable fallback for mobile uploads when Google Drive is unavailable.
ALTER TABLE "Photo" ADD COLUMN "content" BYTEA;
