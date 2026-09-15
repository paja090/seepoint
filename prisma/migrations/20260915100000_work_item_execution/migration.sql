-- Extend existing work items; no duplicate field-job model or generated work orders.
ALTER TABLE "WorkOrderItem"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "executionStatus" "WorkOrderStatus",
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "estimatedMinutes" INTEGER,
  ADD COLUMN "issueType" TEXT,
  ADD COLUMN "issueNote" TEXT,
  ADD COLUMN "crmRealizationId" TEXT;
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_estimatedMinutes_check"
  CHECK ("estimatedMinutes" IS NULL OR "estimatedMinutes" BETWEEN 1 AND 1440);
CREATE UNIQUE INDEX "WorkOrderItem_crmRealizationId_key" ON "WorkOrderItem"("crmRealizationId");
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_crmRealizationId_fkey"
  FOREIGN KEY ("crmRealizationId") REFERENCES "CrmRealization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD COLUMN "workOrderItemId" TEXT;
CREATE INDEX "Photo_workOrderItemId_idx" ON "Photo"("workOrderItemId");
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_workOrderItemId_fkey"
  FOREIGN KEY ("workOrderItemId") REFERENCES "WorkOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Existing completed orders remain completed; nullable item status otherwise preserves legacy semantics.
UPDATE "WorkOrderItem" i SET "executionStatus" = o."status"
FROM "WorkOrder" o WHERE o.id = i."workOrderId" AND o."organizationId" = i."organizationId"
AND o.status IN ('DONE', 'CANCELLED');
