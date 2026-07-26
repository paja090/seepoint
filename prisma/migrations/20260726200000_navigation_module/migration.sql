-- Safe idempotent enum creation
DO $$ BEGIN
  CREATE TYPE "NavigationOrderStatus" AS ENUM (
    'POPTAVKA', 'NABIDKA', 'POTVRZENO_KLIENTEM', 'SMLOUVA_OBJEDNAVKA',
    'GRAFICKE_PODKLADY', 'SCHVALENI_GRAFIKY', 'TISK_VYROBA',
    'PRIPRAVENO_K_INSTALACI', 'INSTALACE', 'FOTODOKUMENTACE',
    'PRIPRAVENO_K_FAKTURACI', 'FAKTUROVANO', 'DOKONCENO'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "NavigationBlockStatus" AS ENUM (
    'CEKA_NA_KLIENTA', 'CEKA_NA_POTVRZENI_NABIDKY', 'CEKA_NA_OBJEDNAVKU',
    'CEKA_NA_GRAFIKU', 'CEKA_NA_SCHVALENI_GRAFIKY', 'CEKA_NA_TISK',
    'CEKA_NA_INSTALACI', 'CEKA_NA_FOTOGRAFIE', 'CEKA_NA_FAKTURACI',
    'INTERNE_POZASTAVENO'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable IF NOT EXISTS
CREATE TABLE IF NOT EXISTS "NavigationOrder" (
    "id" TEXT NOT NULL,
    "crmOrderId" TEXT NOT NULL,
    "status" "NavigationOrderStatus" NOT NULL DEFAULT 'POPTAVKA',
    "blockStatus" "NavigationBlockStatus",
    "rentStart" TIMESTAMP(3),
    "rentEnd" TIMESTAMP(3),
    "installationDate" TIMESTAMP(3),
    "deinstallationDate" TIMESTAMP(3),
    "targetName" TEXT NOT NULL,
    "targetAddress" TEXT,
    "targetLatitude" DOUBLE PRECISION NOT NULL,
    "targetLongitude" DOUBLE PRECISION NOT NULL,
    "targetNote" TEXT,
    "graphicsApprovedAt" TIMESTAMP(3),
    "productionReadyAt" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3),
    "invoicedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavigationOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NavigationBillingPeriod" (
    "id" TEXT NOT NULL,
    "navigationOrderId" TEXT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "invoiceId" TEXT,
    "status" "ClientInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(12,2) NOT NULL,
    "invoicedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NavigationBillingPeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NavigationPriceVersion" (
    "id" TEXT NOT NULL,
    "navigationPointId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "installationPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "removalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "productionPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NavigationPriceVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NavigationPriceAuditLog" (
    "id" TEXT NOT NULL,
    "navigationPointId" TEXT NOT NULL,
    "oldUnitPrice" DECIMAL(12,2),
    "newUnitPrice" DECIMAL(12,2) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changedByUserName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NavigationPriceAuditLog_pkey" PRIMARY KEY ("id")
);

-- AlterTable IF NOT EXISTS
ALTER TABLE "NavigationPoint" ALTER COLUMN "navigationOfferId" DROP NOT NULL;
ALTER TABLE "NavigationPoint" ADD COLUMN IF NOT EXISTS "navigationOrderId" TEXT;
ALTER TABLE "NavigationPoint" ADD COLUMN IF NOT EXISTS "surfaceId" TEXT;
ALTER TABLE "NavigationPoint" ADD COLUMN IF NOT EXISTS "installedPhotoId" TEXT;

-- CreateIndex IF NOT EXISTS
CREATE UNIQUE INDEX IF NOT EXISTS "NavigationOrder_crmOrderId_key" ON "NavigationOrder"("crmOrderId");
CREATE INDEX IF NOT EXISTS "NavigationOrder_status_idx" ON "NavigationOrder"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "NavigationBillingPeriod_invoiceId_key" ON "NavigationBillingPeriod"("invoiceId");
CREATE UNIQUE INDEX IF NOT EXISTS "NavigationBillingPeriod_navigationOrderId_dateFrom_dateTo_key" ON "NavigationBillingPeriod"("navigationOrderId", "dateFrom", "dateTo");
CREATE INDEX IF NOT EXISTS "NavigationBillingPeriod_navigationOrderId_idx" ON "NavigationBillingPeriod"("navigationOrderId");
CREATE INDEX IF NOT EXISTS "NavigationPoint_navigationOrderId_idx" ON "NavigationPoint"("navigationOrderId");
CREATE INDEX IF NOT EXISTS "NavigationPoint_surfaceId_idx" ON "NavigationPoint"("surfaceId");
CREATE INDEX IF NOT EXISTS "NavigationPriceVersion_navigationPointId_validFrom_idx" ON "NavigationPriceVersion"("navigationPointId", "validFrom");
CREATE INDEX IF NOT EXISTS "NavigationPriceAuditLog_navigationPointId_idx" ON "NavigationPriceAuditLog"("navigationPointId");

-- AddForeignKey IF NOT EXISTS safely
DO $$ BEGIN
  ALTER TABLE "NavigationOrder" ADD CONSTRAINT "NavigationOrder_crmOrderId_fkey" FOREIGN KEY ("crmOrderId") REFERENCES "CrmOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NavigationBillingPeriod" ADD CONSTRAINT "NavigationBillingPeriod_navigationOrderId_fkey" FOREIGN KEY ("navigationOrderId") REFERENCES "NavigationOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NavigationBillingPeriod" ADD CONSTRAINT "NavigationBillingPeriod_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ClientInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NavigationPoint" ADD CONSTRAINT "NavigationPoint_navigationOrderId_fkey" FOREIGN KEY ("navigationOrderId") REFERENCES "NavigationOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NavigationPoint" ADD CONSTRAINT "NavigationPoint_surfaceId_fkey" FOREIGN KEY ("surfaceId") REFERENCES "AdvertisingSurface"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NavigationPoint" ADD CONSTRAINT "NavigationPoint_installedPhotoId_fkey" FOREIGN KEY ("installedPhotoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NavigationPriceVersion" ADD CONSTRAINT "NavigationPriceVersion_navigationPointId_fkey" FOREIGN KEY ("navigationPointId") REFERENCES "NavigationPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NavigationPriceVersion" ADD CONSTRAINT "NavigationPriceVersion_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NavigationPriceAuditLog" ADD CONSTRAINT "NavigationPriceAuditLog_navigationPointId_fkey" FOREIGN KEY ("navigationPointId") REFERENCES "NavigationPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "NavigationPriceAuditLog" ADD CONSTRAINT "NavigationPriceAuditLog_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
