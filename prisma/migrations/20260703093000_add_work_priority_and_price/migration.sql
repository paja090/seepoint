CREATE TYPE "WorkPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

ALTER TABLE "WorkOrder"
ADD COLUMN "priority" "WorkPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "price" DECIMAL(12, 2);

CREATE INDEX "WorkOrder_priority_scheduledAt_idx" ON "WorkOrder"("priority", "scheduledAt");
