-- CreateEnum
CREATE TYPE "ElectionRemovalPointStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'ISSUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ElectionRemovalMediaType" AS ENUM ('ACKO', 'BENCH', 'CITY_POSTER', 'MINI_TOWER', 'BANNER', 'PLOT', 'TOWER', 'OTHER');

-- AlterTable
ALTER TABLE "FieldPlan" ADD COLUMN "electionCampaignId" TEXT;

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "electionRemovalPointId" TEXT;

-- CreateTable
CREATE TABLE "ElectionCampaign" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL DEFAULT current_setting('app.current_organization_id'::text, true),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "targetDate" TIMESTAMP(3),
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "completedPoints" INTEGER NOT NULL DEFAULT 0,
    "kmlFileName" TEXT,
    "kmlRawContent" TEXT,
    "mediaDefaults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectionCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionRemovalPoint" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL DEFAULT current_setting('app.current_organization_id'::text, true),
    "campaignId" TEXT NOT NULL,
    "mediaType" "ElectionRemovalMediaType" NOT NULL DEFAULT 'OTHER',
    "mediaTypeRaw" TEXT,
    "layerName" TEXT,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "baseServiceMinutes" INTEGER NOT NULL DEFAULT 10,
    "serviceMinutes" INTEGER NOT NULL DEFAULT 10,
    "status" "ElectionRemovalPointStatus" NOT NULL DEFAULT 'PENDING',
    "assignedFieldPlanId" TEXT,
    "assignedCrewId" TEXT,
    "plannedOrder" INTEGER,
    "plannedArrivalAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "issueType" TEXT,
    "issueNote" TEXT,
    "issueReportedAt" TIMESTAMP(3),
    "issueReportedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectionRemovalPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ElectionCampaign_organizationId_status_idx" ON "ElectionCampaign"("organizationId", "status");
CREATE INDEX "ElectionCampaign_organizationId_createdAt_idx" ON "ElectionCampaign"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ElectionRemovalPoint_organizationId_campaignId_status_idx" ON "ElectionRemovalPoint"("organizationId", "campaignId", "status");
CREATE INDEX "ElectionRemovalPoint_organizationId_latitude_longitude_idx" ON "ElectionRemovalPoint"("organizationId", "latitude", "longitude");
CREATE INDEX "ElectionRemovalPoint_organizationId_assignedFieldPlanId_idx" ON "ElectionRemovalPoint"("organizationId", "assignedFieldPlanId");
CREATE INDEX "ElectionRemovalPoint_campaignId_idx" ON "ElectionRemovalPoint"("campaignId");

-- CreateIndex
CREATE INDEX "FieldPlan_organizationId_electionCampaignId_idx" ON "FieldPlan"("organizationId", "electionCampaignId");

-- CreateIndex
CREATE INDEX "Photo_electionRemovalPointId_idx" ON "Photo"("electionRemovalPointId");

-- AddForeignKey
ALTER TABLE "ElectionCampaign" ADD CONSTRAINT "ElectionCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionRemovalPoint" ADD CONSTRAINT "ElectionRemovalPoint_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ElectionCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionRemovalPoint" ADD CONSTRAINT "ElectionRemovalPoint_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionRemovalPoint" ADD CONSTRAINT "ElectionRemovalPoint_assignedFieldPlanId_fkey" FOREIGN KEY ("assignedFieldPlanId") REFERENCES "FieldPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionRemovalPoint" ADD CONSTRAINT "ElectionRemovalPoint_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldPlan" ADD CONSTRAINT "FieldPlan_electionCampaignId_fkey" FOREIGN KEY ("electionCampaignId") REFERENCES "ElectionCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_electionRemovalPointId_fkey" FOREIGN KEY ("electionRemovalPointId") REFERENCES "ElectionRemovalPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable electionRemoval module for SeePoint canonical tenant
UPDATE "Organization"
SET "enabledModules" = COALESCE("enabledModules", '{}'::jsonb) || '{"electionRemoval": true}'::jsonb
WHERE "slug" = 'seepoint' OR "id" = 'org_seepoint_default';
