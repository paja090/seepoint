-- Phase 3 metadata only. clientId is already nullable, so no client relation rewrite is needed.
CREATE TYPE "ClientResolutionStatus" AS ENUM ('RESOLVED', 'UNRESOLVED');

ALTER TABLE "Occupancy"
  ADD COLUMN "sourceColumn" INTEGER,
  ADD COLUMN "clientResolutionStatus" "ClientResolutionStatus" NOT NULL DEFAULT 'RESOLVED',
  ADD COLUMN "statusDerivation" TEXT;
