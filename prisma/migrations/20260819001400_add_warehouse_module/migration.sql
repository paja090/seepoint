-- CreateEnum
CREATE TYPE "WarehouseItemCategory" AS ENUM ('CONSUMABLE', 'RETURNABLE');

-- CreateEnum
CREATE TYPE "WarehouseMovementType" AS ENUM ('RECEIPT', 'ISSUE', 'RETURN', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "WarehouseItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" "WarehouseItemCategory" NOT NULL DEFAULT 'CONSUMABLE',
    "unit" TEXT NOT NULL DEFAULT 'ks',
    "quantityInStock" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "minQuantity" DECIMAL(10,2),
    "unitPrice" DECIMAL(10,2),
    "location" TEXT,
    "supplierName" TEXT,
    "supplierContact" TEXT,
    "photoUrl" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "WarehouseMovementType" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "workOrderId" TEXT,
    "assignedEmployeeId" TEXT,
    "assignedEmployeeName" TEXT,
    "performedByName" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WarehouseItem_category_idx" ON "WarehouseItem"("category");

-- CreateIndex
CREATE INDEX "WarehouseItem_location_idx" ON "WarehouseItem"("location");

-- CreateIndex
CREATE INDEX "WarehouseMovement_itemId_idx" ON "WarehouseMovement"("itemId");

-- CreateIndex
CREATE INDEX "WarehouseMovement_workOrderId_idx" ON "WarehouseMovement"("workOrderId");

-- CreateIndex
CREATE INDEX "WarehouseMovement_assignedEmployeeId_idx" ON "WarehouseMovement"("assignedEmployeeId");

-- AddForeignKey
ALTER TABLE "WarehouseMovement" ADD CONSTRAINT "WarehouseMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "WarehouseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseMovement" ADD CONSTRAINT "WarehouseMovement_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
