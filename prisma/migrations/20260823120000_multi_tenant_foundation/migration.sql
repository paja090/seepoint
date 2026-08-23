-- Safe, additive multi-tenant migration. Existing rows are assigned to the
-- canonical SeePoint tenant before organizationId becomes mandatory.

DO $$ BEGIN CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'SALES', 'TECHNICIAN', 'WORKER', 'ACCOUNTANT', 'VIEWER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "OrganizationPlan" AS ENUM ('INTERNAL', 'START', 'BUSINESS', 'PRO', 'ENTERPRISE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SubscriptionStatus" AS ENUM ('INTERNAL', 'TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "InventoryVisibility" AS ENUM ('PRIVATE', 'PARTNER', 'SHARED', 'MARKETPLACE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Organization" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "companyId" TEXT,
  "vatId" TEXT,
  "street" TEXT,
  "city" TEXT,
  "postalCode" TEXT,
  "country" TEXT NOT NULL DEFAULT 'CZ',
  "email" TEXT,
  "phone" TEXT,
  "website" TEXT,
  "logoUrl" TEXT,
  "primaryColor" TEXT,
  "secondaryColor" TEXT,
  "emailSignature" TEXT,
  "defaultCurrency" TEXT NOT NULL DEFAULT 'CZK',
  "bankAccount" TEXT,
  "iban" TEXT,
  "swift" TEXT,
  "plan" "OrganizationPlan" NOT NULL DEFAULT 'START',
  "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "trialEndsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "Organization" (
  "id", "name", "slug", "plan", "subscriptionStatus", "isActive", "createdAt", "updatedAt"
) VALUES (
  'org_seepoint_default', 'SeePoint', 'seepoint', 'INTERNAL', 'INTERNAL', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
) ON CONFLICT ("slug") DO NOTHING;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "platformRole" "PlatformRole";
ALTER TABLE "UserSession" ADD COLUMN IF NOT EXISTS "activeOrganizationId" TEXT;
ALTER TABLE "AdvertisingCarrier" ADD COLUMN IF NOT EXISTS "visibility" "InventoryVisibility" NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE "AdvertisingSurface" ADD COLUMN IF NOT EXISTS "visibility" "InventoryVisibility" NOT NULL DEFAULT 'PRIVATE';

CREATE TABLE IF NOT EXISTS "OrganizationMember" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "OrganizationRole" NOT NULL,
  "roles" "OrganizationRole"[] NOT NULL DEFAULT ARRAY[]::"OrganizationRole"[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "OrganizationMember_organizationId_userId_key" UNIQUE ("organizationId", "userId")
);

CREATE TABLE IF NOT EXISTS "OrganizationInvitation" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "OrganizationRole" NOT NULL,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "invitedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "OrganizationInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "Organization_isActive_idx" ON "Organization"("isActive");
CREATE INDEX IF NOT EXISTS "Organization_plan_idx" ON "Organization"("plan");
CREATE INDEX IF NOT EXISTS "OrganizationMember_userId_isActive_idx" ON "OrganizationMember"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "OrganizationMember_organizationId_role_idx" ON "OrganizationMember"("organizationId", "role");
CREATE INDEX IF NOT EXISTS "OrganizationInvitation_organizationId_email_idx" ON "OrganizationInvitation"("organizationId", "email");
CREATE INDEX IF NOT EXISTS "OrganizationInvitation_email_expiresAt_idx" ON "OrganizationInvitation"("email", "expiresAt");

DO $$
DECLARE
  table_name TEXT;
  tenant_tables TEXT[] := ARRAY[
    'UserAuditLog', 'Employee', 'EmployeeBillingProfile', 'EmployeeRate', 'Client',
    'AdvertisingCarrier', 'WorkTask', 'Settlement', 'SettlementItem', 'Vehicle',
    'VehicleReservation', 'VehicleServiceRecord', 'VehicleFuelExpense', 'EmployeeAbsence',
    'ChatMessage', 'ChatRead', 'AdvertisingSurface', 'Occupancy', 'Offer',
    'SalesOpportunity', 'NavigationOffer', 'NavigationPoint', 'NavigationDocumentationReport',
    'NavigationDocumentationItem', 'NavigationReportAuditLog', 'CityGalleryProject',
    'CityGalleryFleetConfig', 'CityGalleryOffer', 'MediaPackage', 'MediaPackageRule',
    'OfferPackageSelection', 'OfferPriceRule', 'OfferCharge', 'OfferItem', 'OfferEvent',
    'Photo', 'ImportBatch', 'PriceListItem', 'ImportRowError', 'WorkOrder',
    'WorkAssignment', 'WorkOrderItem', 'WorkOrderRate', 'CompanyRate', 'WorkEntry',
    'WorkExpense', 'RecurringAdjustment', 'SettlementAdjustment', 'SystemSettings',
    'SettlementAuditLog', 'Invoice', 'InvoiceItem', 'ClientContact', 'ClientBranch',
    'CrmOrder', 'CrmRealization', 'ClientContract', 'ClientInvoice', 'ClientInvoiceItem',
    'ClientCommunication', 'CrmTask', 'ClientDocument', 'CrmAuditLog', 'ClientMergeLog',
    'NavigationOrder', 'SurveyRoute', 'NavigationCandidatePoint', 'NavigationBillingPeriod',
    'NavigationPriceVersion', 'NavigationPriceAuditLog', 'NavigationContract',
    'NavigationContactPerson', 'CarrierHistoryLog', 'CompanyShoppingItem', 'WarehouseItem',
    'WarehouseMovement', 'QuickInternalTask'
  ];
BEGIN
  FOREACH table_name IN ARRAY tenant_tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = current_schema() AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "organizationId" TEXT', table_name);
      EXECUTE format('UPDATE %I SET "organizationId" = %L WHERE "organizationId" IS NULL', table_name, 'org_seepoint_default');
      EXECUTE format('ALTER TABLE %I ALTER COLUMN "organizationId" SET DEFAULT current_setting(''app.current_organization_id''::text, true)', table_name);
      EXECUTE format('ALTER TABLE %I ALTER COLUMN "organizationId" SET NOT NULL', table_name);
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I ("organizationId")', table_name || '_organizationId_idx', table_name);
      BEGIN
        EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT', table_name, table_name || '_organizationId_fkey');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- Legacy singleton rows used a globally fixed primary key. Give them stable,
-- tenant-specific keys before additional organizations create their own config.
UPDATE "SystemSettings"
SET "id" = 'system-settings:' || "organizationId"
WHERE "id" = 'default';

UPDATE "CityGalleryFleetConfig"
SET "id" = 'city-gallery-fleet:' || "organizationId"
WHERE "id" = 'default';

-- Existing accounts become members of the default tenant. Existing ADMINs are
-- made OWNERs so production administration remains available after deploy.
INSERT INTO "OrganizationMember" (
  "id", "organizationId", "userId", "role", "roles", "isActive", "createdAt", "updatedAt"
)
SELECT
  'om_' || md5('org_seepoint_default:' || u."id"),
  'org_seepoint_default',
  u."id",
  CASE WHEN u."role"::text = 'ADMIN' THEN 'OWNER'::"OrganizationRole" ELSE u."role"::text::"OrganizationRole" END,
  ARRAY[]::"OrganizationRole"[],
  u."status"::text <> 'SUSPENDED',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
ON CONFLICT ("organizationId", "userId") DO NOTHING;

-- Preserve a single platform administrator for the legacy installation without
-- conflating every historical organization ADMIN with SUPER_ADMIN.
UPDATE "User"
SET "platformRole" = 'SUPER_ADMIN'::"PlatformRole"
WHERE "id" = (
  SELECT "id" FROM "User"
  WHERE "role"::text = 'ADMIN'
  ORDER BY "createdAt" ASC, "id" ASC
  LIMIT 1
)
AND NOT EXISTS (SELECT 1 FROM "User" WHERE "platformRole" = 'SUPER_ADMIN'::"PlatformRole");

UPDATE "UserSession"
SET "activeOrganizationId" = 'org_seepoint_default'
WHERE "activeOrganizationId" IS NULL;

-- Replace natural-key uniqueness that was valid only in the old single-company system.
DROP INDEX IF EXISTS "Employee_userId_key";
DROP INDEX IF EXISTS "Employee_email_key";
DROP INDEX IF EXISTS "Client_normalizedName_key";
DROP INDEX IF EXISTS "Client_externalCode_key";
DROP INDEX IF EXISTS "AdvertisingCarrier_code_key";
DROP INDEX IF EXISTS "AdvertisingCarrier_sourceKey_key";
DROP INDEX IF EXISTS "AdvertisingSurface_sourceKey_key";
DROP INDEX IF EXISTS "Occupancy_sourceKey_key";
DROP INDEX IF EXISTS "OfferPriceRule_code_key";
DROP INDEX IF EXISTS "PriceListItem_versionKey_key";
DROP INDEX IF EXISTS "Invoice_invoiceNumber_key";
DROP INDEX IF EXISTS "CrmOrder_orderNumber_key";
DROP INDEX IF EXISTS "ClientContract_contractNumber_key";
DROP INDEX IF EXISTS "ClientInvoice_invoiceNumber_key";
DROP INDEX IF EXISTS "NavigationContract_contractNumber_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Employee_organizationId_userId_key" ON "Employee"("organizationId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_organizationId_email_key" ON "Employee"("organizationId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "Client_organizationId_normalizedName_key" ON "Client"("organizationId", "normalizedName");
CREATE UNIQUE INDEX IF NOT EXISTS "Client_organizationId_externalCode_key" ON "Client"("organizationId", "externalCode");
CREATE UNIQUE INDEX IF NOT EXISTS "AdvertisingCarrier_organizationId_code_key" ON "AdvertisingCarrier"("organizationId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "AdvertisingCarrier_organizationId_sourceKey_key" ON "AdvertisingCarrier"("organizationId", "sourceKey");
CREATE UNIQUE INDEX IF NOT EXISTS "AdvertisingSurface_organizationId_sourceKey_key" ON "AdvertisingSurface"("organizationId", "sourceKey");
CREATE UNIQUE INDEX IF NOT EXISTS "Occupancy_organizationId_sourceKey_key" ON "Occupancy"("organizationId", "sourceKey");
CREATE UNIQUE INDEX IF NOT EXISTS "OfferPriceRule_organizationId_code_key" ON "OfferPriceRule"("organizationId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "PriceListItem_organizationId_versionKey_key" ON "PriceListItem"("organizationId", "versionKey");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_organizationId_invoiceNumber_key" ON "Invoice"("organizationId", "invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmOrder_organizationId_orderNumber_key" ON "CrmOrder"("organizationId", "orderNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "ClientContract_organizationId_contractNumber_key" ON "ClientContract"("organizationId", "contractNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "ClientInvoice_organizationId_invoiceNumber_key" ON "ClientInvoice"("organizationId", "invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "NavigationContract_organizationId_contractNumber_key" ON "NavigationContract"("organizationId", "contractNumber");

-- Defense in depth: every existing single-column FK between tenant tables gets
-- an additional composite FK (organizationId, foreignId). This rejects a
-- cross-tenant connect even if application code passes a foreign scalar ID.
DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT
      c.oid,
      child.relname AS child_table,
      parent.relname AS parent_table,
      child_col.attname AS child_column,
      parent_col.attname AS parent_column
    FROM pg_constraint c
    JOIN pg_class child ON child.oid = c.conrelid
    JOIN pg_class parent ON parent.oid = c.confrelid
    JOIN pg_attribute child_col ON child_col.attrelid = c.conrelid AND child_col.attnum = c.conkey[1]
    JOIN pg_attribute parent_col ON parent_col.attrelid = c.confrelid AND parent_col.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND array_length(c.conkey, 1) = 1
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attname = 'organizationId' AND NOT a.attisdropped)
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.confrelid AND a.attname = 'organizationId' AND NOT a.attisdropped)
  LOOP
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I ("organizationId", %I)',
      'mt_parent_' || fk.parent_table || '_' || fk.parent_column,
      fk.parent_table,
      fk.parent_column
    );
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("organizationId", %I) REFERENCES %I ("organizationId", %I) NOT VALID',
        fk.child_table,
        'mt_fk_' || fk.oid,
        fk.child_column,
        fk.parent_table,
        fk.parent_column
      );
      EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', fk.child_table, 'mt_fk_' || fk.oid);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
