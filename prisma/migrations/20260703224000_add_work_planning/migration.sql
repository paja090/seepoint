CREATE TYPE "WorkOrderStatus" AS ENUM ('NEW', 'PLANNED', 'HANDED_OVER', 'IN_PROGRESS', 'DONE', 'CANCELLED');
CREATE TYPE "WorkType" AS ENUM ('INSTALLATION', 'REINSTALLATION', 'DEINSTALLATION', 'REPAIR', 'CHECK', 'TRANSPORT', 'OTHER');

CREATE TABLE "WorkOrder" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "WorkOrderStatus" NOT NULL DEFAULT 'NEW',
  "workType" "WorkType" NOT NULL DEFAULT 'OTHER',
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "deadlineAt" TIMESTAMP(3),
  "campaignDateFrom" TIMESTAMP(3),
  "campaignDateTo" TIMESTAMP(3),
  "clientId" TEXT,
  "clientName" TEXT NOT NULL,
  "requestedBy" TEXT,
  "contactName" TEXT,
  "contactPhone" TEXT,
  "locationNote" TEXT,
  "mediaLabel" TEXT,
  "quantity" INTEGER,
  "referenceUrl" TEXT,
  "ftdUrl" TEXT,
  "ftdSent" BOOLEAN NOT NULL DEFAULT false,
  "invoiced" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkAssignment" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "userId" TEXT,
  "workerName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkOrderItem" (
  "id" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "carrierId" TEXT,
  "surfaceId" TEXT,
  "description" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkOrder_scheduledAt_status_idx" ON "WorkOrder"("scheduledAt", "status");
CREATE INDEX "WorkOrder_clientId_idx" ON "WorkOrder"("clientId");
CREATE INDEX "WorkAssignment_workOrderId_idx" ON "WorkAssignment"("workOrderId");
CREATE INDEX "WorkAssignment_userId_idx" ON "WorkAssignment"("userId");
CREATE INDEX "WorkOrderItem_workOrderId_idx" ON "WorkOrderItem"("workOrderId");
CREATE INDEX "WorkOrderItem_carrierId_idx" ON "WorkOrderItem"("carrierId");
CREATE INDEX "WorkOrderItem_surfaceId_idx" ON "WorkOrderItem"("surfaceId");

ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "AdvertisingCarrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_surfaceId_fkey" FOREIGN KEY ("surfaceId") REFERENCES "AdvertisingSurface"("id") ON DELETE SET NULL ON UPDATE CASCADE;
