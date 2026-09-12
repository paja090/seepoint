-- 1. Update IntegrationConnection unique constraint to support multiple mailboxes per organization
DROP INDEX IF EXISTS "IntegrationConnection_organizationId_provider_key";

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationConnection_organizationId_provider_externalAccountId_key"
  ON "IntegrationConnection"("organizationId", "provider", "externalAccountId");

CREATE INDEX IF NOT EXISTS "IntegrationConnection_organizationId_provider_idx"
  ON "IntegrationConnection"("organizationId", "provider");

-- 2. Add AI_INBOX to AIFeatureType enum
DO $$ BEGIN
  ALTER TYPE "AIFeatureType" ADD VALUE IF NOT EXISTS 'AI_INBOX';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Create AI Inbox enums
DO $$ BEGIN
  CREATE TYPE "AiInboxStatus" AS ENUM (
    'INGESTED',
    'ANALYZING',
    'READY',
    'REVIEW_REQUIRED',
    'PROCESSED',
    'IGNORED',
    'ERROR'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AiInboxClassification" AS ENUM (
    'NEW_INQUIRY',
    'EXISTING_PROJECT_REPLY',
    'OFFER_ACCEPTED',
    'OFFER_REJECTED',
    'CHANGE_REQUEST',
    'GRAPHIC_ASSETS',
    'GRAPHIC_APPROVAL',
    'DOCUMENTS',
    'INSTALLATION_REQUEST',
    'PHOTO_DOCUMENTATION',
    'INVOICE_BILLING',
    'COMPLAINT',
    'GENERAL_COMMUNICATION',
    'SPAM_IRRELEVANT',
    'UNKNOWN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AiInboxAttachmentClassification" AS ENUM (
    'LOGO',
    'GRAPHIC_ASSET',
    'ORDER_DOCUMENT',
    'CONTRACT',
    'MAP',
    'PRICE_LIST',
    'PHOTO',
    'INVOICE',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AiInboxActionType" AS ENUM (
    'CREATE_CLIENT',
    'LINK_CLIENT',
    'CREATE_CONTACT',
    'CREATE_CRM_ORDER',
    'LINK_CRM_ORDER',
    'CREATE_OFFER',
    'UPDATE_OFFER',
    'ACCEPT_OFFER',
    'CREATE_NAVIGATION_ORDER',
    'UPDATE_NAVIGATION_ORDER',
    'CHANGE_NAVIGATION_STATUS',
    'CREATE_TASK',
    'STORE_DOCUMENT',
    'CREATE_COMMUNICATION',
    'PREPARE_EMAIL_REPLY'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AiInboxActionStatus" AS ENUM (
    'PROPOSED',
    'APPROVED',
    'EXECUTED',
    'REJECTED',
    'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Create AiInboxMessage table
CREATE TABLE IF NOT EXISTS "AiInboxMessage" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL DEFAULT current_setting('app.current_organization_id'::text, true),
  "integrationConnectionId" TEXT,
  "provider" "IntegrationProvider" NOT NULL DEFAULT 'GMAIL',
  "providerMessageId" TEXT NOT NULL,
  "providerThreadId" TEXT,
  "internetMessageId" TEXT,
  "inReplyTo" TEXT,
  "references" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "fromEmail" TEXT NOT NULL,
  "fromName" TEXT,
  "toEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ccEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "subject" TEXT NOT NULL,
  "textBody" TEXT,
  "htmlBody" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "processingStatus" "AiInboxStatus" NOT NULL DEFAULT 'INGESTED',
  "classification" "AiInboxClassification" NOT NULL DEFAULT 'UNKNOWN',
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "requiresReview" BOOLEAN NOT NULL DEFAULT true,
  "aiSummary" TEXT,
  "aiReasoningSummary" TEXT,
  "aiExtractedData" JSONB,
  "suggestedReply" TEXT,
  "errorMessage" TEXT,
  "clientId" TEXT,
  "contactId" TEXT,
  "crmOrderId" TEXT,
  "offerId" TEXT,
  "navigationOrderId" TEXT,
  "salesOpportunityId" TEXT,
  "processedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiInboxMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiInboxMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiInboxMessage_integrationConnectionId_fkey" FOREIGN KEY ("integrationConnectionId") REFERENCES "IntegrationConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AiInboxMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AiInboxMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AiInboxMessage_crmOrderId_fkey" FOREIGN KEY ("crmOrderId") REFERENCES "CrmOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AiInboxMessage_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AiInboxMessage_navigationOrderId_fkey" FOREIGN KEY ("navigationOrderId") REFERENCES "NavigationOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AiInboxMessage_salesOpportunityId_fkey" FOREIGN KEY ("salesOpportunityId") REFERENCES "SalesOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AiInboxMessage_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AiInboxMessage_organizationId_provider_providerMessageId_key"
  ON "AiInboxMessage"("organizationId", "provider", "providerMessageId");

CREATE INDEX IF NOT EXISTS "AiInboxMessage_organizationId_processingStatus_idx"
  ON "AiInboxMessage"("organizationId", "processingStatus");

CREATE INDEX IF NOT EXISTS "AiInboxMessage_organizationId_receivedAt_idx"
  ON "AiInboxMessage"("organizationId", "receivedAt");

CREATE INDEX IF NOT EXISTS "AiInboxMessage_organizationId_providerThreadId_idx"
  ON "AiInboxMessage"("organizationId", "providerThreadId");

CREATE INDEX IF NOT EXISTS "AiInboxMessage_organizationId_clientId_idx"
  ON "AiInboxMessage"("organizationId", "clientId");

CREATE INDEX IF NOT EXISTS "AiInboxMessage_organizationId_crmOrderId_idx"
  ON "AiInboxMessage"("organizationId", "crmOrderId");

CREATE INDEX IF NOT EXISTS "AiInboxMessage_organizationId_offerId_idx"
  ON "AiInboxMessage"("organizationId", "offerId");

CREATE INDEX IF NOT EXISTS "AiInboxMessage_organizationId_navigationOrderId_idx"
  ON "AiInboxMessage"("organizationId", "navigationOrderId");

-- 5. Create AiInboxAttachment table
CREATE TABLE IF NOT EXISTS "AiInboxAttachment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL DEFAULT current_setting('app.current_organization_id'::text, true),
  "messageId" TEXT NOT NULL,
  "providerAttachmentId" TEXT,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL DEFAULT 0,
  "classification" "AiInboxAttachmentClassification" NOT NULL DEFAULT 'OTHER',
  "clientDocumentId" TEXT,
  "fileUrl" TEXT,
  "storageKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiInboxAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiInboxAttachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiInboxAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AiInboxMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiInboxAttachment_clientDocumentId_fkey" FOREIGN KEY ("clientDocumentId") REFERENCES "ClientDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AiInboxAttachment_organizationId_messageId_idx"
  ON "AiInboxAttachment"("organizationId", "messageId");

CREATE INDEX IF NOT EXISTS "AiInboxAttachment_organizationId_clientDocumentId_idx"
  ON "AiInboxAttachment"("organizationId", "clientDocumentId");

-- 6. Create AiInboxAction table
CREATE TABLE IF NOT EXISTS "AiInboxAction" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL DEFAULT current_setting('app.current_organization_id'::text, true),
  "messageId" TEXT NOT NULL,
  "type" "AiInboxActionType" NOT NULL,
  "status" "AiInboxActionStatus" NOT NULL DEFAULT 'PROPOSED',
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "errorMessage" TEXT,
  "executedAt" TIMESTAMP(3),
  "executedById" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AiInboxAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiInboxAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiInboxAction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AiInboxMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiInboxAction_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AiInboxAction_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AiInboxAction_organizationId_messageId_idx"
  ON "AiInboxAction"("organizationId", "messageId");

CREATE INDEX IF NOT EXISTS "AiInboxAction_organizationId_status_idx"
  ON "AiInboxAction"("organizationId", "status");
