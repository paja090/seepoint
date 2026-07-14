-- AlterTable SettlementItem: Make rateType nullable and drop the default value
ALTER TABLE "SettlementItem" ALTER COLUMN "rateType" DROP NOT NULL;
ALTER TABLE "SettlementItem" ALTER COLUMN "rateType" DROP DEFAULT;

-- Backfill appliedRate from unitPrice for legacy items
UPDATE "SettlementItem" SET "appliedRate" = COALESCE("unitPrice", 0.00);

-- AlterTable SettlementAdjustment: Add correctionKey with a unique index
ALTER TABLE "SettlementAdjustment" ADD COLUMN "correctionKey" TEXT;
CREATE UNIQUE INDEX "SettlementAdjustment_correctionKey_key" ON "SettlementAdjustment"("correctionKey");

-- AlterTable SystemSettings: Add CHECK constraint to enforce ID is always 'default'
ALTER TABLE "SystemSettings" ADD CONSTRAINT "SystemSettings_id_singleton" CHECK (id = 'default');
