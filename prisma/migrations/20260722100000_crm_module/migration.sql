-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('LEAD', 'ACTIVE', 'INACTIVE', 'BLOCKED', 'FORMER_CLIENT');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('DIRECT_CLIENT', 'ADVERTISING_AGENCY', 'MEDIA_AGENCY', 'RETAIL_CHAIN', 'LOCAL_BUSINESS', 'PUBLIC_INSTITUTION', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientSource" AS ENUM ('RECOMMENDATION', 'WEBSITE', 'OUTBOUND', 'EXHIBITION', 'IMPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "PreferredContactMethod" AS ENUM ('EMAIL', 'PHONE', 'SMS', 'MEETING');

-- CreateEnum
CREATE TYPE "CrmOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'WAITING_FOR_MATERIALS', 'READY_FOR_PRODUCTION', 'IN_REALIZATION', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CrmProjectType" AS ENUM ('NAVIGATION', 'CITY_GALLERY', 'BENCH', 'CITY_POSTER', 'CLV', 'TOWER', 'HORIZON', 'COMBINED', 'OTHER');

-- CreateEnum
CREATE TYPE "RealizationStatus" AS ENUM ('WAITING_FOR_MATERIALS', 'MATERIALS_APPROVED', 'WAITING_FOR_PRODUCTION', 'PRODUCED', 'SCHEDULED', 'INSTALLATION_IN_PROGRESS', 'INSTALLED', 'PHOTOGRAPHED', 'DELIVERED_TO_CLIENT', 'CLAIM', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'WAITING_FOR_SIGNATURE', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'TERMINATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('RENTAL', 'SERVICE', 'FRAMEWORK', 'OTHER');

-- CreateEnum
CREATE TYPE "ClientInvoiceType" AS ENUM ('REGULAR', 'PROFORMA', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "ClientInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('PHONE_CALL', 'EMAIL', 'IN_PERSON_MEETING', 'ONLINE_MEETING', 'NOTE', 'OFFER_SENT', 'ORDER_RECEIVED', 'COMPLAINT', 'INTERNAL_NOTE');

-- CreateEnum
CREATE TYPE "CrmTaskType" AS ENUM ('CALL_CLIENT', 'PREPARE_OFFER', 'VERIFY_MATERIALS', 'GET_CONTRACT_SIGNED', 'PLAN_REALIZATION', 'PROVIDE_PHOTO_DOCS', 'ISSUE_INVOICE', 'RESOLVE_DEBT', 'RENEW_CAMPAIGN', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CrmTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "assignedUserId" TEXT,
ADD COLUMN     "billingCity" TEXT,
ADD COLUMN     "billingCountry" TEXT DEFAULT 'CZ',
ADD COLUMN     "billingStreet" TEXT,
ADD COLUMN     "billingZip" TEXT,
ADD COLUMN     "clientType" "ClientType" NOT NULL DEFAULT 'DIRECT_CLIENT',
ADD COLUMN     "dic" TEXT,
ADD COLUMN     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "rating" TEXT,
ADD COLUMN     "shippingCity" TEXT,
ADD COLUMN     "shippingCountry" TEXT DEFAULT 'CZ',
ADD COLUMN     "shippingStreet" TEXT,
ADD COLUMN     "shippingZip" TEXT,
ADD COLUMN     "source" "ClientSource" NOT NULL DEFAULT 'WEBSITE',
ADD COLUMN     "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "tradingName" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "crmRealizationId" TEXT;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "crmOrderId" TEXT;

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "title" TEXT,
    "department" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "note" TEXT,
    "preferredCommunication" "PreferredContactMethod" NOT NULL DEFAULT 'EMAIL',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isCommercial" BOOLEAN NOT NULL DEFAULT true,
    "isRealization" BOOLEAN NOT NULL DEFAULT false,
    "isBilling" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientBranch" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contactPersonId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "street" TEXT,
    "city" TEXT,
    "zip" TEXT,
    "country" TEXT DEFAULT 'CZ',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "openingHoursNote" TEXT,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "clientOrderCode" TEXT,
    "clientId" TEXT NOT NULL,
    "contactId" TEXT,
    "branchId" TEXT,
    "offerId" TEXT,
    "assignedUserId" TEXT,
    "title" TEXT NOT NULL,
    "projectType" "CrmProjectType" NOT NULL DEFAULT 'OTHER',
    "status" "CrmOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "dateFrom" TIMESTAMP(3),
    "dateTo" TIMESTAMP(3),
    "totalPrice" DECIMAL(12,2),
    "billingMethod" TEXT,
    "note" TEXT,
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmRealization" (
    "id" TEXT NOT NULL,
    "crmOrderId" TEXT NOT NULL,
    "surfaceId" TEXT,
    "carrierId" TEXT,
    "workOrderId" TEXT,
    "assignedUserId" TEXT,
    "status" "RealizationStatus" NOT NULL DEFAULT 'WAITING_FOR_MATERIALS',
    "plannedDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "note" TEXT,
    "claimNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmRealization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientContract" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "contractNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ContractType" NOT NULL DEFAULT 'RENTAL',
    "signedAt" TIMESTAMP(3),
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "noticePeriodDays" INTEGER DEFAULT 30,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "valueAmount" DECIMAL(12,2),
    "driveFileId" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientInvoice" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "crmOrderId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "variableSymbol" TEXT,
    "type" "ClientInvoiceType" NOT NULL DEFAULT 'REGULAR',
    "status" "ClientInvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "pdfUrl" TEXT,
    "driveFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientInvoiceItem" (
    "id" TEXT NOT NULL,
    "clientInvoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ks',
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "ClientInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientCommunication" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contactId" TEXT,
    "authorUserId" TEXT NOT NULL,
    "crmOrderId" TEXT,
    "type" "CommunicationType" NOT NULL DEFAULT 'PHONE_CALL',
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "result" TEXT,
    "nextStep" TEXT,
    "nextContactDate" TIMESTAMP(3),
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientCommunication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTask" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contactId" TEXT,
    "crmOrderId" TEXT,
    "contractId" TEXT,
    "invoiceId" TEXT,
    "assignedUserId" TEXT NOT NULL,
    "createdUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "CrmTaskType" NOT NULL DEFAULT 'OTHER',
    "priority" "CrmTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "CrmTaskStatus" NOT NULL DEFAULT 'TODO',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "resultNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientDocument" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "crmOrderId" TEXT,
    "contractId" TEXT,
    "invoiceId" TEXT,
    "uploaderUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "driveFileId" TEXT,
    "fileUrl" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "detailsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMergeLog" (
    "id" TEXT NOT NULL,
    "targetClientId" TEXT NOT NULL,
    "sourceClientId" TEXT NOT NULL,
    "sourceClientName" TEXT NOT NULL,
    "performedByUserId" TEXT NOT NULL,
    "detailsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMergeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientContact_clientId_idx" ON "ClientContact"("clientId");

-- CreateIndex
CREATE INDEX "ClientBranch_clientId_idx" ON "ClientBranch"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmOrder_orderNumber_key" ON "CrmOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CrmOrder_offerId_key" ON "CrmOrder"("offerId");

-- CreateIndex
CREATE INDEX "CrmOrder_clientId_idx" ON "CrmOrder"("clientId");

-- CreateIndex
CREATE INDEX "CrmOrder_status_idx" ON "CrmOrder"("status");

-- CreateIndex
CREATE INDEX "CrmRealization_crmOrderId_idx" ON "CrmRealization"("crmOrderId");

-- CreateIndex
CREATE INDEX "CrmRealization_status_idx" ON "CrmRealization"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientContract_contractNumber_key" ON "ClientContract"("contractNumber");

-- CreateIndex
CREATE INDEX "ClientContract_clientId_idx" ON "ClientContract"("clientId");

-- CreateIndex
CREATE INDEX "ClientContract_status_validTo_idx" ON "ClientContract"("status", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvoice_invoiceNumber_key" ON "ClientInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "ClientInvoice_clientId_idx" ON "ClientInvoice"("clientId");

-- CreateIndex
CREATE INDEX "ClientInvoice_status_dueDate_idx" ON "ClientInvoice"("status", "dueDate");

-- CreateIndex
CREATE INDEX "ClientInvoiceItem_clientInvoiceId_idx" ON "ClientInvoiceItem"("clientInvoiceId");

-- CreateIndex
CREATE INDEX "ClientCommunication_clientId_idx" ON "ClientCommunication"("clientId");

-- CreateIndex
CREATE INDEX "ClientCommunication_authorUserId_idx" ON "ClientCommunication"("authorUserId");

-- CreateIndex
CREATE INDEX "CrmTask_clientId_idx" ON "CrmTask"("clientId");

-- CreateIndex
CREATE INDEX "CrmTask_assignedUserId_status_dueDate_idx" ON "CrmTask"("assignedUserId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "ClientDocument_clientId_idx" ON "ClientDocument"("clientId");

-- CreateIndex
CREATE INDEX "CrmAuditLog_entityType_entityId_idx" ON "CrmAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "CrmAuditLog_createdAt_idx" ON "CrmAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ClientMergeLog_targetClientId_idx" ON "ClientMergeLog"("targetClientId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_crmRealizationId_fkey" FOREIGN KEY ("crmRealizationId") REFERENCES "CrmRealization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_crmOrderId_fkey" FOREIGN KEY ("crmOrderId") REFERENCES "CrmOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBranch" ADD CONSTRAINT "ClientBranch_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBranch" ADD CONSTRAINT "ClientBranch_contactPersonId_fkey" FOREIGN KEY ("contactPersonId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOrder" ADD CONSTRAINT "CrmOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOrder" ADD CONSTRAINT "CrmOrder_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOrder" ADD CONSTRAINT "CrmOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "ClientBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOrder" ADD CONSTRAINT "CrmOrder_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmOrder" ADD CONSTRAINT "CrmOrder_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmRealization" ADD CONSTRAINT "CrmRealization_crmOrderId_fkey" FOREIGN KEY ("crmOrderId") REFERENCES "CrmOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmRealization" ADD CONSTRAINT "CrmRealization_surfaceId_fkey" FOREIGN KEY ("surfaceId") REFERENCES "AdvertisingSurface"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmRealization" ADD CONSTRAINT "CrmRealization_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "AdvertisingCarrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmRealization" ADD CONSTRAINT "CrmRealization_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmRealization" ADD CONSTRAINT "CrmRealization_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContract" ADD CONSTRAINT "ClientContract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContract" ADD CONSTRAINT "ClientContract_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_crmOrderId_fkey" FOREIGN KEY ("crmOrderId") REFERENCES "CrmOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoiceItem" ADD CONSTRAINT "ClientInvoiceItem_clientInvoiceId_fkey" FOREIGN KEY ("clientInvoiceId") REFERENCES "ClientInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCommunication" ADD CONSTRAINT "ClientCommunication_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCommunication" ADD CONSTRAINT "ClientCommunication_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCommunication" ADD CONSTRAINT "ClientCommunication_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCommunication" ADD CONSTRAINT "ClientCommunication_crmOrderId_fkey" FOREIGN KEY ("crmOrderId") REFERENCES "CrmOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_crmOrderId_fkey" FOREIGN KEY ("crmOrderId") REFERENCES "CrmOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ClientContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ClientInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_createdUserId_fkey" FOREIGN KEY ("createdUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_crmOrderId_fkey" FOREIGN KEY ("crmOrderId") REFERENCES "CrmOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ClientContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ClientInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_uploaderUserId_fkey" FOREIGN KEY ("uploaderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmAuditLog" ADD CONSTRAINT "CrmAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMergeLog" ADD CONSTRAINT "ClientMergeLog_targetClientId_fkey" FOREIGN KEY ("targetClientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMergeLog" ADD CONSTRAINT "ClientMergeLog_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
