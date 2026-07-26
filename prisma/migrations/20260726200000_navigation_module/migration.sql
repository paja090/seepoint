-- CreateEnum
CREATE TYPE "NavigationOrderStatus" AS ENUM (
  'POPTAVKA',
  'NABIDKA',
  'POTVRZENO_KLIENTEM',
  'SMLOUVA_OBJEDNAVKA',
  'GRAFICKE_PODKLADY',
  'SCHVALENI_GRAFIKY',
  'TISK_VYROBA',
  'PRIPRAVENO_K_INSTALACI',
  'INSTALACE',
  'FOTODOKUMENTACE',
  'PRIPRAVENO_K_FAKTURACI',
  'FAKTUROVANO',
  'DOKONCENO'
);

-- CreateEnum
CREATE TYPE "NavigationBlockStatus" AS ENUM (
  'CEKA_NA_KLIENTA',
  'CEKA_NA_POTVRZENI_NABIDKY',
  'CEKA_NA_OBJEDNAVKU',
  'CEKA_NA_GRAFIKU',
  'CEKA_NA_SCHVALENI_GRAFIKY',
  'CEKA_NA_TISK',
  'CEKA_NA_INSTALACI',
  'CEKA_NA_FOTOGRAFIE',
  'CEKA_NA_FAKTURACI',
  'INTERNE_POZASTAVENO'
);

-- CreateTable
CREATE TABLE "NavigationOrder" (
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

-- CreateTable
CREATE TABLE "NavigationBillingPeriod" (
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

-- AlterTable
ALTER TABLE "NavigationPoint" ALTER COLUMN "navigationOfferId" DROP NOT NULL,
ADD COLUMN "navigationOrderId" TEXT,
ADD COLUMN "surfaceId" TEXT,
ADD COLUMN "installedPhotoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "NavigationOrder_crmOrderId_key" ON "NavigationOrder"("crmOrderId");
CREATE INDEX "NavigationOrder_status_idx" ON "NavigationOrder"("status");
CREATE UNIQUE INDEX "NavigationBillingPeriod_invoiceId_key" ON "NavigationBillingPeriod"("invoiceId");
CREATE UNIQUE INDEX "NavigationBillingPeriod_navigationOrderId_dateFrom_dateTo_key" ON "NavigationBillingPeriod"("navigationOrderId", "dateFrom", "dateTo");
CREATE INDEX "NavigationBillingPeriod_navigationOrderId_idx" ON "NavigationBillingPeriod"("navigationOrderId");
CREATE INDEX "NavigationPoint_navigationOrderId_idx" ON "NavigationPoint"("navigationOrderId");
CREATE INDEX "NavigationPoint_surfaceId_idx" ON "NavigationPoint"("surfaceId");

-- AddForeignKey
ALTER TABLE "NavigationOrder" ADD CONSTRAINT "NavigationOrder_crmOrderId_fkey" FOREIGN KEY ("crmOrderId") REFERENCES "CrmOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NavigationBillingPeriod" ADD CONSTRAINT "NavigationBillingPeriod_navigationOrderId_fkey" FOREIGN KEY ("navigationOrderId") REFERENCES "NavigationOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NavigationBillingPeriod" ADD CONSTRAINT "NavigationBillingPeriod_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ClientInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NavigationPoint" ADD CONSTRAINT "NavigationPoint_navigationOrderId_fkey" FOREIGN KEY ("navigationOrderId") REFERENCES "NavigationOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NavigationPoint" ADD CONSTRAINT "NavigationPoint_surfaceId_fkey" FOREIGN KEY ("surfaceId") REFERENCES "AdvertisingSurface"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NavigationPoint" ADD CONSTRAINT "NavigationPoint_installedPhotoId_fkey" FOREIGN KEY ("installedPhotoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
