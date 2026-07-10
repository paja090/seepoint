ALTER TABLE "WorkTask" ADD COLUMN "workOrderId" TEXT;

CREATE INDEX "WorkTask_workOrderId_idx" ON "WorkTask"("workOrderId");

ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
