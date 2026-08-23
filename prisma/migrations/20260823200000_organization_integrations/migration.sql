DO $$ BEGIN
  CREATE TYPE "IntegrationProvider" AS ENUM ('GOOGLE_DRIVE', 'GMAIL', 'GOOGLE_WORKSPACE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'ERROR', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "IntegrationConnection" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'CONNECTED',
  "externalAccountId" TEXT,
  "accountEmail" TEXT,
  "credentialsEncrypted" TEXT,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "connectedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3),
  "error" TEXT,
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IntegrationConnection_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationConnection_organizationId_provider_key"
  ON "IntegrationConnection"("organizationId", "provider");
CREATE INDEX IF NOT EXISTS "IntegrationConnection_organizationId_status_idx"
  ON "IntegrationConnection"("organizationId", "status");
