-- AlterTable WorkOrder
ALTER TABLE "WorkOrder" ADD COLUMN "estimatedHours" DECIMAL(5,2);
ALTER TABLE "WorkOrder" ADD COLUMN "pdfUrl" TEXT;
