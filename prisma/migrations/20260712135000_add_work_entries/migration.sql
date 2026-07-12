-- CreateEnum
CREATE TYPE "WorkEntryStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "WorkEntryCreationSource" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "RateSource" AS ENUM ('EMPLOYEE_RATE', 'COMPANY_RATE', 'MANUAL');

-- CreateTable
CREATE TABLE "CompanyRate" (
    "id" TEXT NOT NULL,
    "type" "RateType" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CZK',
    "unit" TEXT,
    "workType" "WorkType",
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkEntry" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "workTaskId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "clientId" TEXT,
    "clientName" TEXT,
    "workType" "WorkType" NOT NULL,
    "remunerationMethod" "RateType" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "appliedUnitRate" DECIMAL(12,2),
    "calculatedAmount" DECIMAL(12,2) NOT NULL,
    "rateSource" "RateSource",
    "note" TEXT,
    "status" "WorkEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "creationSource" "WorkEntryCreationSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyRate_type_workType_validFrom_idx" ON "CompanyRate"("type", "workType", "validFrom");
CREATE INDEX "CompanyRate_isActive_validFrom_validTo_idx" ON "CompanyRate"("isActive", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "WorkEntry_employeeId_idx" ON "WorkEntry"("employeeId");
CREATE INDEX "WorkEntry_workTaskId_idx" ON "WorkEntry"("workTaskId");
CREATE INDEX "WorkEntry_workOrderId_idx" ON "WorkEntry"("workOrderId");
CREATE INDEX "WorkEntry_status_idx" ON "WorkEntry"("status");
CREATE INDEX "WorkEntry_workDate_idx" ON "WorkEntry"("workDate");

-- AddForeignKey
ALTER TABLE "WorkEntry" ADD CONSTRAINT "WorkEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkEntry" ADD CONSTRAINT "WorkEntry_workTaskId_fkey" FOREIGN KEY ("workTaskId") REFERENCES "WorkTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkEntry" ADD CONSTRAINT "WorkEntry_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkEntry" ADD CONSTRAINT "WorkEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
