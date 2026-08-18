-- AlterTable Vehicle
ALTER TABLE "Vehicle" ADD COLUMN "highwayPassUntil" TIMESTAMP(3);
ALTER TABLE "Vehicle" ADD COLUMN "responsiblePerson" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "tiresInfo" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "owner" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "vtpUrl" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "repairNotes" TEXT;
