-- AlterEnum
ALTER TYPE "FieldPlanStatus" ADD VALUE 'SUPERSEDED';

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "capacitySlots" INTEGER,
ADD COLUMN     "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "fieldWorkStepId" TEXT;

-- AlterTable
ALTER TABLE "ElectionCampaign" ADD COLUMN     "clientName" TEXT;

-- AlterTable
ALTER TABLE "ElectionRemovalPoint" ADD COLUMN     "accessInstructions" TEXT,
ADD COLUMN     "carrierId" TEXT,
ADD COLUMN     "contact" TEXT,
ADD COLUMN     "deadlineAt" TIMESTAMP(3),
ADD COLUMN     "destinationLatitude" DOUBLE PRECISION,
ADD COLUMN     "destinationLongitude" DOUBLE PRECISION,
ADD COLUMN     "destinationName" TEXT,
ADD COLUMN     "loadSlots" INTEGER,
ADD COLUMN     "materialDisposition" TEXT,
ADD COLUMN     "materialInstructions" TEXT,
ADD COLUMN     "objectType" TEXT,
ADD COLUMN     "operationType" TEXT,
ADD COLUMN     "referenceUrl" TEXT,
ADD COLUMN     "requiredEquipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "requiredPositions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "requiredWorkers" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "reviewRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "surfaceId" TEXT;

-- CreateTable
CREATE TABLE "FieldWorkStep" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "serviceMinutes" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "completedQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "loadDelta" INTEGER NOT NULL DEFAULT 0,
    "photoType" "PhotoType",
    "assignedFieldPlanId" TEXT,
    "assignedCrewId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "issueNote" TEXT,
    "custodyNote" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldWorkStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FieldWorkStep_organizationId_assignedFieldPlanId_status_idx" ON "FieldWorkStep"("organizationId", "assignedFieldPlanId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FieldWorkStep_pointId_sequence_key" ON "FieldWorkStep"("pointId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "FieldWorkStep_id_organizationId_key" ON "FieldWorkStep"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ElectionRemovalPoint_id_organizationId_key" ON "ElectionRemovalPoint"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_fieldWorkStepId_organizationId_fkey" FOREIGN KEY ("fieldWorkStepId", "organizationId") REFERENCES "FieldWorkStep"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldWorkStep" ADD CONSTRAINT "FieldWorkStep_pointId_organizationId_fkey" FOREIGN KEY ("pointId", "organizationId") REFERENCES "ElectionRemovalPoint"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ElectionRemovalPoint" ADD COLUMN "windowStart" TIMESTAMP(3), ADD COLUMN "windowEnd" TIMESTAMP(3);

-- Operational invariants. No legacy state, descriptions, photos or plan statuses are rewritten.
ALTER TABLE "FieldWorkStep" ADD CONSTRAINT "FieldWorkStep_quantity_check"
  CHECK ("quantity" > 0 AND "completedQuantity" >= 0 AND "completedQuantity" <= "quantity" AND "serviceMinutes" > 0);
ALTER TABLE "FieldWorkStep" ADD CONSTRAINT "FieldWorkStep_gps_check"
  CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180);
ALTER TABLE "FieldWorkStep" ADD CONSTRAINT "FieldWorkStep_status_check"
  CHECK ("status" IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'ISSUE', 'COMPLETED', 'CANCELLED'));
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_capacitySlots_check" CHECK ("capacitySlots" IS NULL OR "capacitySlots" > 0);

-- Only unambiguous explicit markers are backfilled. Even these need material/GPS review.
-- Safe to repeat independently: only NULL structured values are touched.
UPDATE "ElectionRemovalPoint" SET "operationType" = CASE
  WHEN "description" ~* '\[Operace:\s*Jiná práce\s*\]|\[OTHER\]' THEN 'OTHER'
  WHEN "description" ~* '\[Operace:\s*(Převoz na jiné místo|Převoz|Přemístění|Relokace)\s*\]|\[RELOCATION\]' THEN 'RELOCATION'
  WHEN "description" ~* '\[Operace:\s*(Výměna plachty|Jen plachta|Plachta)\s*\]|\[BANNER_CHANGE\]' THEN 'REPLACE_AD'
  WHEN "description" ~* '\[Operace:\s*(Odvoz na sklad|Sklad|Demontáž)\s*\]|\[FULL_REMOVAL\]' THEN 'REMOVE_OBJECT'
  ELSE NULL END
WHERE "operationType" IS NULL;
