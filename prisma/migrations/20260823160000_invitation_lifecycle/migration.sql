ALTER TABLE "OrganizationInvitation"
  ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

-- Older preview retries may have produced multiple usable invitations. Keep only
-- the newest pending token for each organization and e-mail address.
WITH ranked AS (
  SELECT "id",
         row_number() OVER (
           PARTITION BY "organizationId", lower("email")
           ORDER BY "createdAt" DESC, "id" DESC
         ) AS position
  FROM "OrganizationInvitation"
  WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL
)
UPDATE "OrganizationInvitation" AS invitation
SET "revokedAt" = CURRENT_TIMESTAMP
FROM ranked
WHERE invitation."id" = ranked."id" AND ranked.position > 1;

UPDATE "UserToken" AS token
SET "usedAt" = COALESCE(token."usedAt", CURRENT_TIMESTAMP)
FROM "OrganizationInvitation" AS invitation
WHERE invitation."tokenHash" = token."tokenHash"
  AND invitation."revokedAt" IS NOT NULL
  AND token."usedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "OrganizationInvitation_organizationId_acceptedAt_revokedAt_idx"
  ON "OrganizationInvitation"("organizationId", "acceptedAt", "revokedAt");
