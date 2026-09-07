-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EmailDomainStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EmailLogStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'DELIVERY_DELAYED', 'BOUNCED', 'COMPLAINED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable OrganizationEmailSettings
CREATE TABLE IF NOT EXISTS "OrganizationEmailSettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "senderName" TEXT NOT NULL,
  "fromEmail" TEXT NOT NULL,
  "replyTo" TEXT,
  "providerDomainId" TEXT,
  "status" "EmailDomainStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "dnsRecords" JSONB,
  "encryptedSendingApiKey" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "lastTestedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrganizationEmailSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationEmailSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationEmailSettings_organizationId_key" ON "OrganizationEmailSettings"("organizationId");
CREATE INDEX IF NOT EXISTS "OrganizationEmailSettings_organizationId_idx" ON "OrganizationEmailSettings"("organizationId");
CREATE INDEX IF NOT EXISTS "OrganizationEmailSettings_domain_idx" ON "OrganizationEmailSettings"("domain");
CREATE INDEX IF NOT EXISTS "OrganizationEmailSettings_providerDomainId_idx" ON "OrganizationEmailSettings"("providerDomainId");

-- CreateTable EmailLog
CREATE TABLE IF NOT EXISTS "EmailLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "recipient" TEXT NOT NULL,
  "from" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "template" TEXT NOT NULL DEFAULT 'general',
  "status" "EmailLogStatus" NOT NULL DEFAULT 'SENT',
  "error" TEXT,
  "metadata" JSONB,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailLog_providerMessageId_key" ON "EmailLog"("providerMessageId");
CREATE INDEX IF NOT EXISTS "EmailLog_organizationId_sentAt_idx" ON "EmailLog"("organizationId", "sentAt");
CREATE INDEX IF NOT EXISTS "EmailLog_providerMessageId_idx" ON "EmailLog"("providerMessageId");
CREATE INDEX IF NOT EXISTS "EmailLog_status_idx" ON "EmailLog"("status");
