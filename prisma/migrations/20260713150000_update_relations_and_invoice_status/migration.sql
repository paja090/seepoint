-- AlterTable SystemSettings: make billing fields nullable and drop defaults
ALTER TABLE "SystemSettings" ALTER COLUMN "companyId" DROP NOT NULL;
ALTER TABLE "SystemSettings" ALTER COLUMN "companyId" DROP DEFAULT;
ALTER TABLE "SystemSettings" ALTER COLUMN "vatId" DROP NOT NULL;
ALTER TABLE "SystemSettings" ALTER COLUMN "vatId" DROP DEFAULT;
ALTER TABLE "SystemSettings" ALTER COLUMN "street" DROP NOT NULL;
ALTER TABLE "SystemSettings" ALTER COLUMN "street" DROP DEFAULT;
ALTER TABLE "SystemSettings" ALTER COLUMN "city" DROP NOT NULL;
ALTER TABLE "SystemSettings" ALTER COLUMN "city" DROP DEFAULT;
ALTER TABLE "SystemSettings" ALTER COLUMN "postalCode" DROP NOT NULL;
ALTER TABLE "SystemSettings" ALTER COLUMN "postalCode" DROP DEFAULT;
ALTER TABLE "SystemSettings" ALTER COLUMN "country" DROP NOT NULL;
ALTER TABLE "SystemSettings" ALTER COLUMN "country" DROP DEFAULT;

-- Clean up fake default data from SystemSettings
UPDATE "SystemSettings" SET 
  "companyId" = NULL, 
  "vatId" = NULL, 
  "street" = NULL, 
  "city" = NULL, 
  "postalCode" = NULL, 
  "country" = NULL 
WHERE "id" = 'default'
  AND "companyId" = '12345678'
  AND "vatId" = 'CZ12345678'
  AND "street" = 'Mezibranská 1367/21'
  AND "city" = 'Praha'
  AND "postalCode" = '110 00';

-- Create InvoiceStatus Enum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'CANCELLED');

-- AlterTable Invoice status column
ALTER TABLE "Invoice" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Invoice" ALTER COLUMN "status" TYPE "InvoiceStatus" USING ("status"::text::"InvoiceStatus");
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- Drop old foreign key constraints
ALTER TABLE "WorkExpense" DROP CONSTRAINT "WorkExpense_workEntryId_fkey";
ALTER TABLE "SettlementAdjustment" DROP CONSTRAINT "SettlementAdjustment_settlementId_fkey";
ALTER TABLE "SettlementAdjustment" DROP CONSTRAINT "SettlementAdjustment_correctionWorkEntryId_fkey";
ALTER TABLE "SettlementAdjustment" DROP CONSTRAINT "SettlementAdjustment_correctionSettlementItemId_fkey";
ALTER TABLE "SettlementItem" DROP CONSTRAINT "SettlementItem_settlementId_fkey";

-- Add new restrictive foreign key constraints
ALTER TABLE "WorkExpense" ADD CONSTRAINT "WorkExpense_workEntryId_fkey" FOREIGN KEY ("workEntryId") REFERENCES "WorkEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_correctionWorkEntryId_fkey" FOREIGN KEY ("correctionWorkEntryId") REFERENCES "WorkEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_correctionSettlementItemId_fkey" FOREIGN KEY ("correctionSettlementItemId") REFERENCES "SettlementItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementItem" ADD CONSTRAINT "SettlementItem_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add new relation correctionOriginalSettlement
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_correctionOriginalSettlementId_fkey" FOREIGN KEY ("correctionOriginalSettlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add carry-over snapshot columns to SettlementAdjustment
ALTER TABLE "SettlementAdjustment" ADD COLUMN "previousEffectiveAmount" DECIMAL(12,2);
ALTER TABLE "SettlementAdjustment" ADD COLUMN "correctedEffectiveAmount" DECIMAL(12,2);
ALTER TABLE "SettlementAdjustment" ADD COLUMN "correctedQuantity" DECIMAL(10,2);
ALTER TABLE "SettlementAdjustment" ADD COLUMN "correctedUnitRate" DECIMAL(12,2);
ALTER TABLE "SettlementAdjustment" ADD COLUMN "correctedNote" TEXT;
