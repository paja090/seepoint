CREATE TYPE "RateType" AS ENUM ('HOURLY', 'TASK', 'FIXED');
CREATE TYPE "BillingSubjectType" AS ENUM ('INDIVIDUAL', 'SOLE_TRADER', 'COMPANY');

CREATE TABLE "EmployeeBillingProfile" (
  "id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "subjectType" "BillingSubjectType" NOT NULL DEFAULT 'INDIVIDUAL',
  "billingName" TEXT NOT NULL, "companyId" TEXT, "vatId" TEXT, "vatPayer" BOOLEAN NOT NULL DEFAULT false,
  "street" TEXT, "city" TEXT, "postalCode" TEXT, "country" TEXT NOT NULL DEFAULT 'CZ', "accountNumber" TEXT,
  "bankCode" TEXT, "iban" TEXT, "swift" TEXT, "billingEmail" TEXT, "billingPhone" TEXT, "paymentTermsDays" INTEGER,
  "note" TEXT, "updatedByUserId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "EmployeeBillingProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EmployeeRate" (
  "id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "type" "RateType" NOT NULL, "name" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL, "currency" TEXT NOT NULL DEFAULT 'CZK', "unit" TEXT, "workType" "WorkType",
  "validFrom" TIMESTAMP(3) NOT NULL, "validTo" TIMESTAMP(3), "note" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT, "updatedByUserId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "EmployeeRate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmployeeBillingProfile_employeeId_key" ON "EmployeeBillingProfile"("employeeId");
CREATE INDEX "EmployeeBillingProfile_companyId_idx" ON "EmployeeBillingProfile"("companyId");
CREATE INDEX "EmployeeRate_employeeId_type_workType_validFrom_idx" ON "EmployeeRate"("employeeId", "type", "workType", "validFrom");
CREATE INDEX "EmployeeRate_employeeId_isActive_validFrom_validTo_idx" ON "EmployeeRate"("employeeId", "isActive", "validFrom", "validTo");
ALTER TABLE "EmployeeBillingProfile" ADD CONSTRAINT "EmployeeBillingProfile_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeRate" ADD CONSTRAINT "EmployeeRate_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
