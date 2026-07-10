-- Extend existing role enum for internal operations.
ALTER TYPE "Role" ADD VALUE 'MANAGER';
ALTER TYPE "Role" ADD VALUE 'ACCOUNTANT';

CREATE TYPE "EmploymentType" AS ENUM ('EMPLOYEE', 'CONTRACTOR', 'FREELANCER', 'PART_TIME', 'OTHER');
CREATE TYPE "WorkTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');
CREATE TYPE "WorkTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PAID', 'REJECTED');
CREATE TYPE "VehicleType" AS ENUM ('CAR', 'VAN', 'TRAILER', 'OTHER');
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'IN_USE', 'SERVICE', 'OUT_OF_SERVICE');
CREATE TYPE "ReservationStatus" AS ENUM ('RESERVED', 'ACTIVE', 'FINISHED', 'CANCELLED');

CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "position" TEXT,
    "role" "Role" NOT NULL DEFAULT 'WORKER',
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'EMPLOYEE',
    "ico" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkTask" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedToEmployeeId" TEXT,
    "createdByEmployeeId" TEXT,
    "carrierId" TEXT,
    "vehicleId" TEXT,
    "dueDate" TIMESTAMP(3),
    "scheduledDate" TIMESTAMP(3),
    "priority" "WorkTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "WorkTaskStatus" NOT NULL DEFAULT 'TODO',
    "location" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(12,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementItem" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "taskId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2),
    "unit" TEXT,
    "unitPrice" DECIMAL(12,2),
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    CONSTRAINT "SettlementItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL DEFAULT 'CAR',
    "registrationNumber" TEXT,
    "vin" TEXT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "technicalInspectionUntil" TIMESTAMP(3),
    "insuranceUntil" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VehicleReservation" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VehicleReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VehicleServiceRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cost" DECIMAL(12,2),
    "mileage" INTEGER,
    "nextServiceDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VehicleServiceRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
CREATE INDEX "Employee_role_idx" ON "Employee"("role");
CREATE INDEX "Employee_isActive_idx" ON "Employee"("isActive");
CREATE INDEX "Employee_lastName_firstName_idx" ON "Employee"("lastName", "firstName");
CREATE INDEX "WorkTask_assignedToEmployeeId_idx" ON "WorkTask"("assignedToEmployeeId");
CREATE INDEX "WorkTask_createdByEmployeeId_idx" ON "WorkTask"("createdByEmployeeId");
CREATE INDEX "WorkTask_carrierId_idx" ON "WorkTask"("carrierId");
CREATE INDEX "WorkTask_vehicleId_idx" ON "WorkTask"("vehicleId");
CREATE INDEX "WorkTask_status_scheduledDate_idx" ON "WorkTask"("status", "scheduledDate");
CREATE INDEX "WorkTask_priority_dueDate_idx" ON "WorkTask"("priority", "dueDate");
CREATE INDEX "Settlement_employeeId_idx" ON "Settlement"("employeeId");
CREATE INDEX "Settlement_status_periodFrom_periodTo_idx" ON "Settlement"("status", "periodFrom", "periodTo");
CREATE INDEX "SettlementItem_settlementId_idx" ON "SettlementItem"("settlementId");
CREATE INDEX "SettlementItem_taskId_idx" ON "SettlementItem"("taskId");
CREATE INDEX "SettlementItem_date_idx" ON "SettlementItem"("date");
CREATE INDEX "Vehicle_type_status_idx" ON "Vehicle"("type", "status");
CREATE INDEX "Vehicle_registrationNumber_idx" ON "Vehicle"("registrationNumber");
CREATE INDEX "VehicleReservation_vehicleId_idx" ON "VehicleReservation"("vehicleId");
CREATE INDEX "VehicleReservation_employeeId_idx" ON "VehicleReservation"("employeeId");
CREATE INDEX "VehicleReservation_status_dateFrom_dateTo_idx" ON "VehicleReservation"("status", "dateFrom", "dateTo");
CREATE INDEX "VehicleServiceRecord_vehicleId_idx" ON "VehicleServiceRecord"("vehicleId");
CREATE INDEX "VehicleServiceRecord_date_idx" ON "VehicleServiceRecord"("date");
CREATE INDEX "VehicleServiceRecord_nextServiceDate_idx" ON "VehicleServiceRecord"("nextServiceDate");

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_assignedToEmployeeId_fkey" FOREIGN KEY ("assignedToEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "AdvertisingCarrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementItem" ADD CONSTRAINT "SettlementItem_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SettlementItem" ADD CONSTRAINT "SettlementItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VehicleReservation" ADD CONSTRAINT "VehicleReservation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleReservation" ADD CONSTRAINT "VehicleReservation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleServiceRecord" ADD CONSTRAINT "VehicleServiceRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
