-- AlterTable
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "enabledModules" JSONB;
