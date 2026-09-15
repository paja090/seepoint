CREATE TYPE "FieldPlanStatus" AS ENUM ('DRAFT', 'APPROVED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
ALTER TABLE "WorkOrder" ADD COLUMN "planningConstraints" JSONB;
CREATE TABLE "OrganizationFieldPlanningProfile" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL UNIQUE REFERENCES "Organization"("id") ON DELETE CASCADE,
  "configuration" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "FieldPlan" (
  "id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "date" TEXT NOT NULL, "version" INTEGER NOT NULL, "requestKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "parentPlanId" TEXT, "status" "FieldPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" TEXT NOT NULL, "approvedByUserId" TEXT, "approvedAt" TIMESTAMP(3),
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "planningInputSnapshot" JSONB NOT NULL, "planningSummary" JSONB NOT NULL, "approvalSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FieldPlan_organizationId_date_version_key" UNIQUE ("organizationId", "date", "version"),
  CONSTRAINT "FieldPlan_organizationId_requestKey_key" UNIQUE ("organizationId", "requestKey")
);
CREATE INDEX "FieldPlan_organizationId_date_status_idx" ON "FieldPlan"("organizationId", "date", "status");
