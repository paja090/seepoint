-- CreateTable: OrganizationCarrierType
CREATE TABLE "OrganizationCarrierType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL DEFAULT current_setting('app.current_organization_id'::text, true),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "legacyEnumValue" TEXT,
    "capabilities" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationCarrierType_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Product
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL DEFAULT current_setting('app.current_organization_id'::text, true),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "carrierTypeId" TEXT,
    "unit" TEXT DEFAULT 'plocha',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add carrierTypeId to AdvertisingCarrier
ALTER TABLE "AdvertisingCarrier" ADD COLUMN "carrierTypeId" TEXT;

-- AlterTable: Add carrierTypeLabel to EmployeeRate
ALTER TABLE "EmployeeRate" ADD COLUMN "carrierTypeLabel" TEXT;

-- AlterTable: Add carrierTypeLabel to SettlementItem
ALTER TABLE "SettlementItem" ADD COLUMN "carrierTypeLabel" TEXT;

-- AlterTable: Add carrierTypeId to AdvertisingSurface
ALTER TABLE "AdvertisingSurface" ADD COLUMN "carrierTypeId" TEXT;

-- AlterTable: Add carrierTypeId and carrierTypeLabel to MediaPackageRule
ALTER TABLE "MediaPackageRule" ADD COLUMN "carrierTypeId" TEXT;

-- AlterTable: Add carrierTypeId to OfferPriceRule
ALTER TABLE "OfferPriceRule" ADD COLUMN "carrierTypeId" TEXT;

-- AlterTable: Add carrierTypeId to PriceListItem
ALTER TABLE "PriceListItem" ADD COLUMN "carrierTypeId" TEXT;

-- AlterTable: Add carrierTypeLabel to WorkOrderRate
ALTER TABLE "WorkOrderRate" ADD COLUMN "carrierTypeLabel" TEXT;

-- AlterTable: Add carrierTypeLabel to CompanyRate
ALTER TABLE "CompanyRate" ADD COLUMN "carrierTypeLabel" TEXT;

-- AlterTable: Add carrierTypeLabel to WorkEntry
ALTER TABLE "WorkEntry" ADD COLUMN "carrierTypeLabel" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationCarrierType_organizationId_code_key" ON "OrganizationCarrierType"("organizationId", "code");
CREATE INDEX "OrganizationCarrierType_organizationId_active_sortOrder_idx" ON "OrganizationCarrierType"("organizationId", "active", "sortOrder");
CREATE INDEX "OrganizationCarrierType_legacyEnumValue_idx" ON "OrganizationCarrierType"("legacyEnumValue");

CREATE UNIQUE INDEX "Product_organizationId_code_key" ON "Product"("organizationId", "code");
CREATE INDEX "Product_organizationId_active_sortOrder_idx" ON "Product"("organizationId", "active", "sortOrder");
CREATE INDEX "Product_carrierTypeId_idx" ON "Product"("carrierTypeId");

CREATE INDEX "AdvertisingCarrier_carrierTypeId_idx" ON "AdvertisingCarrier"("carrierTypeId");
CREATE INDEX "AdvertisingSurface_carrierTypeId_idx" ON "AdvertisingSurface"("carrierTypeId");
CREATE INDEX "MediaPackageRule_carrierTypeId_idx" ON "MediaPackageRule"("carrierTypeId");
CREATE INDEX "PriceListItem_carrierTypeId_idx" ON "PriceListItem"("carrierTypeId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_carrierTypeId_fkey" FOREIGN KEY ("carrierTypeId") REFERENCES "OrganizationCarrierType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvertisingCarrier" ADD CONSTRAINT "AdvertisingCarrier_carrierTypeId_fkey" FOREIGN KEY ("carrierTypeId") REFERENCES "OrganizationCarrierType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvertisingSurface" ADD CONSTRAINT "AdvertisingSurface_carrierTypeId_fkey" FOREIGN KEY ("carrierTypeId") REFERENCES "OrganizationCarrierType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MediaPackageRule" ADD CONSTRAINT "MediaPackageRule_carrierTypeId_fkey" FOREIGN KEY ("carrierTypeId") REFERENCES "OrganizationCarrierType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfferPriceRule" ADD CONSTRAINT "OfferPriceRule_carrierTypeId_fkey" FOREIGN KEY ("carrierTypeId") REFERENCES "OrganizationCarrierType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PriceListItem" ADD CONSTRAINT "PriceListItem_carrierTypeId_fkey" FOREIGN KEY ("carrierTypeId") REFERENCES "OrganizationCarrierType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
