-- AlterTable
ALTER TABLE "SalesOpportunity" ADD COLUMN     "dataConflicts" JSONB,
ADD COLUMN     "fieldProvenance" JSONB,
ADD COLUMN     "mergedIntoId" TEXT,
ADD COLUMN     "normalizedCity" TEXT,
ADD COLUMN     "normalizedCompany" TEXT,
ADD COLUMN     "normalizedProject" TEXT,
ADD COLUMN     "projectIdentifier" TEXT,
ADD COLUMN     "semanticData" JSONB,
ADD COLUMN     "tenderIdentifier" TEXT;

-- AlterTable
ALTER TABLE "RadarSignal" ADD COLUMN     "candidateOpportunityId" TEXT,
ADD COLUMN     "canonicalOpportunityId" TEXT,
ADD COLUMN     "keptSeparateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "resolution" JSONB,
ADD COLUMN     "semanticConfidence" DOUBLE PRECISION,
ADD COLUMN     "semanticDecision" TEXT,
ADD COLUMN     "sourceDomain" TEXT;

-- CreateIndex
CREATE INDEX "SalesOpportunity_organizationId_normalizedCompany_normalize_idx" ON "SalesOpportunity"("organizationId", "normalizedCompany", "normalizedCity");

-- CreateIndex
CREATE INDEX "SalesOpportunity_organizationId_normalizedCity_eventType_idx" ON "SalesOpportunity"("organizationId", "normalizedCity", "eventType");

-- CreateIndex
CREATE INDEX "SalesOpportunity_organizationId_normalizedProject_idx" ON "SalesOpportunity"("organizationId", "normalizedProject");

-- CreateIndex
CREATE INDEX "SalesOpportunity_organizationId_projectIdentifier_idx" ON "SalesOpportunity"("organizationId", "projectIdentifier");

-- CreateIndex
CREATE INDEX "SalesOpportunity_organizationId_tenderIdentifier_idx" ON "SalesOpportunity"("organizationId", "tenderIdentifier");

-- CreateIndex
CREATE INDEX "SalesOpportunity_organizationId_mergedIntoId_idx" ON "SalesOpportunity"("organizationId", "mergedIntoId");

-- CreateIndex
CREATE INDEX "SalesOpportunity_organizationId_sourceUrl_idx" ON "SalesOpportunity"("organizationId", "sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOpportunity_organizationId_id_key" ON "SalesOpportunity"("organizationId", "id");

-- CreateIndex
CREATE INDEX "RadarSignal_organizationId_canonicalOpportunityId_idx" ON "RadarSignal"("organizationId", "canonicalOpportunityId");

-- CreateIndex
CREATE INDEX "RadarSignal_organizationId_semanticDecision_idx" ON "RadarSignal"("organizationId", "semanticDecision");

-- AddForeignKey
ALTER TABLE "RadarSignal" ADD CONSTRAINT "RadarSignal_organizationId_canonicalOpportunityId_fkey" FOREIGN KEY ("organizationId", "canonicalOpportunityId") REFERENCES "SalesOpportunity"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Additive backfill only: no Opportunity is merged or removed.
-- Normalize the Czech/European names used by the application without an extension.
UPDATE "SalesOpportunity" SET
 "normalizedCompany" = nullif(trim(regexp_replace(translate(lower("companyName"), 'áčďéěíňóřšťúůýžäöü', 'acdeeinorstuuyzaou'), '[^a-z0-9]+', ' ', 'g')), ''),
 "normalizedCity" = nullif(trim(regexp_replace(translate(lower("city"), 'áčďéěíňóřšťúůýžäöü', 'acdeeinorstuuyzaou'), '[^a-z0-9]+', ' ', 'g')), ''),
 "semanticData" = jsonb_strip_nulls(jsonb_build_object('companyName', "companyName", 'city', "city", 'region', "region", 'address', "address", 'opportunityType', "eventType"::text, 'projectDescription', "summary"))
 WHERE "semanticData" IS NULL;

-- Reuse original RadarSignal rows. Only accept tenant-valid pointers.
UPDATE "RadarSignal" s SET "canonicalOpportunityId" = o.id
FROM "SalesOpportunity" o
WHERE s."organizationId" = o."organizationId" AND s."discoveredOpportunityId" = o.id;

UPDATE "RadarSignal" s SET "canonicalOpportunityId" = x.id
FROM (SELECT DISTINCT ON ("organizationId", "radarSignalId") id, "organizationId", "radarSignalId"
      FROM "SalesOpportunity" WHERE "radarSignalId" IS NOT NULL ORDER BY "organizationId", "radarSignalId", "createdAt", id) x
WHERE s.id = x."radarSignalId" AND s."organizationId" = x."organizationId" AND s."canonicalOpportunityId" IS NULL;

INSERT INTO "RadarSignal" (id, "organizationId", "sourceUrl", "sourceTitle", "sourcePublishedAt", status, "parsedData", "canonicalOpportunityId", "discoveredOpportunityId", "createdAt", "updatedAt")
SELECT 'legacy_' || o.id, o."organizationId", o."sourceUrl", o."sourceTitle", o."sourcePublishedAt", 'PROCESSED', to_jsonb(o), o.id, o.id, o."createdAt", CURRENT_TIMESTAMP
FROM "SalesOpportunity" o
ON CONFLICT ("organizationId", "sourceUrl") DO NOTHING;

UPDATE "RadarSignal" s SET "canonicalOpportunityId" = x.id
FROM (SELECT DISTINCT ON ("organizationId", "sourceUrl") id, "organizationId", "sourceUrl"
      FROM "SalesOpportunity" ORDER BY "organizationId", "sourceUrl", "createdAt", id) x
WHERE s."organizationId" = x."organizationId" AND s."sourceUrl" = x."sourceUrl" AND s."canonicalOpportunityId" IS NULL;

UPDATE "RadarSignal" s SET "parsedData" = coalesce(s."parsedData", to_jsonb(o)),
 "sourceDomain" = substring(s."sourceUrl" from '^https?://([^/:?#]+)')
FROM "SalesOpportunity" o WHERE o.id = s."canonicalOpportunityId" AND o."organizationId" = s."organizationId";
