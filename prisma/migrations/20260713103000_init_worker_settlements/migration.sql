-- AlterEnum
ALTER TYPE "EmploymentType" ADD VALUE 'DPP';
ALTER TYPE "EmploymentType" ADD VALUE 'DPC';

-- AlterEnum
ALTER TYPE "PhotoType" ADD VALUE 'EXPENSE_RECEIPT';

-- AlterEnum
ALTER TYPE "SettlementStatus" ADD VALUE 'LOCKED';

-- AlterEnum
ALTER TYPE "WorkEntryStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "WorkEntryStatus" ADD VALUE 'APPROVED';
ALTER TYPE "WorkEntryStatus" ADD VALUE 'RETURNED';

-- AlterTable
ALTER TABLE "EmployeeBillingProfile" ADD COLUMN     "invoiceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "invoiceNumberPrefix" TEXT,
ADD COLUMN     "nextInvoiceNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "defaultDueDays" INTEGER NOT NULL DEFAULT 14;

-- AlterTable
ALTER TABLE "EmployeeRate" ADD COLUMN     "carrierType" "CarrierType";

-- AlterTable
ALTER TABLE "WorkTask" ADD COLUMN     "remunerationMethod" "RateType" NOT NULL DEFAULT 'HOURLY',
ADD COLUMN     "plannedQuantity" DECIMAL(10,2),
ADD COLUMN     "plannedTimeHours" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "WorkOrderRate" ADD COLUMN     "carrierType" "CarrierType";

-- AlterTable
ALTER TABLE "CompanyRate" ADD COLUMN     "carrierType" "CarrierType";

-- AlterTable
ALTER TABLE "WorkEntry" ADD COLUMN     "carrierType" "CarrierType",
ADD COLUMN     "timeFrom" TIMESTAMP(3),
ADD COLUMN     "timeTo" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT;

-- Migrate CONFIRMED status to SUBMITTED
UPDATE "WorkEntry" SET status = 'SUBMITTED' WHERE status = 'CONFIRMED';

-- AlterTable for Photo
ALTER TABLE "Photo" ADD COLUMN     "taskId" TEXT,
ADD COLUMN     "workEntryId" TEXT,
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: WorkExpense
CREATE TABLE "WorkExpense" (
    "id" TEXT NOT NULL,
    "workEntryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "receiptPhotoId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable: RecurringAdjustment
CREATE TABLE "RecurringAdjustment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "category" "AdjustmentCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SettlementAdjustment
CREATE TABLE "SettlementAdjustment" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "recurringAdjustmentId" TEXT,
    "workExpenseId" TEXT,
    "correctionWorkEntryId" TEXT,
    "correctionSettlementItemId" TEXT,
    "correctionOriginalSettlementId" TEXT,
    "type" "AdjustmentType" NOT NULL,
    "category" "AdjustmentCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "reason" TEXT,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SystemSettings
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "companyName" TEXT NOT NULL DEFAULT 'SeePoint s.r.o.',
    "companyId" TEXT NOT NULL DEFAULT '12345678',
    "vatId" TEXT NOT NULL DEFAULT 'CZ12345678',
    "street" TEXT NOT NULL DEFAULT 'Mezibranská 1367/21',
    "city" TEXT NOT NULL DEFAULT 'Praha',
    "postalCode" TEXT NOT NULL DEFAULT '110 00',
    "country" TEXT NOT NULL DEFAULT 'CZ',
    "bankAccount" TEXT,
    "iban" TEXT,
    "swift" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SettlementAuditLog
CREATE TABLE "SettlementAuditLog" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Invoice
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "supplierName" TEXT NOT NULL,
    "supplierIco" TEXT,
    "supplierDic" TEXT,
    "supplierAddress" TEXT NOT NULL,
    "supplierAccount" TEXT,
    "supplierIban" TEXT,
    "supplierSwift" TEXT,
    "supplierVatPayer" BOOLEAN NOT NULL DEFAULT false,
    "customerName" TEXT NOT NULL,
    "customerIco" TEXT,
    "customerDic" TEXT,
    "customerAddress" TEXT NOT NULL,
    "customerAccount" TEXT,
    "customerIban" TEXT,
    "customerSwift" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InvoiceItem
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "totalAmount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable Settlement
ALTER TABLE "Settlement" ADD COLUMN     "periodYear" INTEGER NOT NULL DEFAULT 2026,
ADD COLUMN     "periodMonth" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "totalWorkAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "totalReimbursements" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "totalDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "totalAdvances" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "finalPayableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "paidAmount" DECIMAL(12,2),
ADD COLUMN     "paymentDate" TIMESTAMP(3);

-- Update existing Settlements to populate periodYear and periodMonth from periodFrom
UPDATE "Settlement" SET "periodYear" = EXTRACT(YEAR FROM "periodFrom"), "periodMonth" = EXTRACT(MONTH FROM "periodFrom");

-- AlterTable SettlementItem
ALTER TABLE "SettlementItem" ADD COLUMN     "workEntryId" TEXT,
ADD COLUMN     "appliedRate" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "rateType" "RateType" NOT NULL DEFAULT 'HOURLY',
ADD COLUMN     "rateSource" "RateSource",
ADD COLUMN     "rateId" TEXT,
ADD COLUMN     "carrierType" "CarrierType",
ADD COLUMN     "workType" "WorkType";

-- CreateIndexes & Unique Constraints
CREATE UNIQUE INDEX "Settlement_employeeId_periodYear_periodMonth_key" ON "Settlement"("employeeId", "periodYear", "periodMonth");
CREATE UNIQUE INDEX "SettlementItem_workEntryId_key" ON "SettlementItem"("workEntryId");
CREATE UNIQUE INDEX "SettlementAdjustment_workExpenseId_key" ON "SettlementAdjustment"("workExpenseId");
CREATE UNIQUE INDEX "SettlementAdjustment_settlementId_recurringAdjustmentId_key" ON "SettlementAdjustment"("settlementId", "recurringAdjustmentId");
CREATE UNIQUE INDEX "Invoice_settlementId_key" ON "Invoice"("settlementId");
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

CREATE INDEX "WorkExpense_workEntryId_idx" ON "WorkExpense"("workEntryId");
CREATE INDEX "RecurringAdjustment_employeeId_idx" ON "RecurringAdjustment"("employeeId");
CREATE INDEX "SettlementAdjustment_settlementId_idx" ON "SettlementAdjustment"("settlementId");
CREATE INDEX "SettlementAdjustment_recurringAdjustmentId_idx" ON "SettlementAdjustment"("recurringAdjustmentId");
CREATE INDEX "SettlementAdjustment_workExpenseId_idx" ON "SettlementAdjustment"("workExpenseId");
CREATE INDEX "SettlementAuditLog_settlementId_idx" ON "SettlementAuditLog"("settlementId");
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_workEntryId_fkey" FOREIGN KEY ("workEntryId") REFERENCES "WorkEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementItem" ADD CONSTRAINT "SettlementItem_workEntryId_fkey" FOREIGN KEY ("workEntryId") REFERENCES "WorkEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkExpense" ADD CONSTRAINT "WorkExpense_workEntryId_fkey" FOREIGN KEY ("workEntryId") REFERENCES "WorkEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringAdjustment" ADD CONSTRAINT "RecurringAdjustment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_recurringAdjustmentId_fkey" FOREIGN KEY ("recurringAdjustmentId") REFERENCES "RecurringAdjustment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_workExpenseId_fkey" FOREIGN KEY ("workExpenseId") REFERENCES "WorkExpense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_correctionWorkEntryId_fkey" FOREIGN KEY ("correctionWorkEntryId") REFERENCES "WorkEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SettlementAdjustment" ADD CONSTRAINT "SettlementAdjustment_correctionSettlementItemId_fkey" FOREIGN KEY ("correctionSettlementItemId") REFERENCES "SettlementItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementAuditLog" ADD CONSTRAINT "SettlementAuditLog_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
