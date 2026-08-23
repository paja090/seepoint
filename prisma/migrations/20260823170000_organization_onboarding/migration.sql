DO $$
BEGIN
  CREATE TYPE "OrganizationOnboardingStep" AS ENUM ('COMPANY', 'OWNER', 'SETTINGS', 'INVENTORY', 'TEAM', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OrganizationOnboarding" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "currentStep" "OrganizationOnboardingStep" NOT NULL DEFAULT 'COMPANY',
  "companyCompletedAt" TIMESTAMP(3),
  "ownerCompletedAt" TIMESTAMP(3),
  "settingsCompletedAt" TIMESTAMP(3),
  "inventoryCompletedAt" TIMESTAMP(3),
  "teamCompletedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationOnboarding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationOnboarding_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationOnboarding_organizationId_key"
  ON "OrganizationOnboarding"("organizationId");
CREATE INDEX IF NOT EXISTS "OrganizationOnboarding_currentStep_idx"
  ON "OrganizationOnboarding"("currentStep");

-- Existing organizations become resumable without changing any domain data.
-- Steps that can be proven from current records are marked complete; company
-- settings remain an explicit confirmation by an organization administrator.
INSERT INTO "OrganizationOnboarding" (
  "id", "organizationId", "currentStep", "companyCompletedAt",
  "ownerCompletedAt", "inventoryCompletedAt", "teamCompletedAt",
  "createdAt", "updatedAt"
)
SELECT
  'onb_' || md5(organization."id"),
  organization."id",
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "OrganizationMember" member
      JOIN "User" account ON account."id" = member."userId"
      WHERE member."organizationId" = organization."id"
        AND member."role" = 'OWNER'
        AND member."isActive" = TRUE
        AND account."status" = 'ACTIVE'
    ) THEN 'SETTINGS'::"OrganizationOnboardingStep"
    ELSE 'OWNER'::"OrganizationOnboardingStep"
  END,
  organization."createdAt",
  CASE WHEN EXISTS (
    SELECT 1 FROM "OrganizationMember" member
    JOIN "User" account ON account."id" = member."userId"
    WHERE member."organizationId" = organization."id"
      AND member."role" = 'OWNER'
      AND member."isActive" = TRUE
      AND account."status" = 'ACTIVE'
  ) THEN CURRENT_TIMESTAMP END,
  CASE WHEN EXISTS (
    SELECT 1 FROM "AdvertisingSurface" surface
    WHERE surface."organizationId" = organization."id"
  ) THEN CURRENT_TIMESTAMP END,
  CASE WHEN (
    SELECT count(*) FROM "OrganizationMember" member
    WHERE member."organizationId" = organization."id" AND member."isActive" = TRUE
  ) > 1 THEN CURRENT_TIMESTAMP END,
  organization."createdAt",
  CURRENT_TIMESTAMP
FROM "Organization" organization
ON CONFLICT ("organizationId") DO NOTHING;
