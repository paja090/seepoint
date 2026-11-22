-- AlterTable: Add Agency fields to CrmOrder
ALTER TABLE "CrmOrder" ADD COLUMN "agencyClientId" TEXT;
ALTER TABLE "CrmOrder" ADD COLUMN "agencyName" TEXT;

-- AlterTable: Add ClientBranch relation to CrmRealization, WorkOrderItem, Photo, and NavigationTarget
ALTER TABLE "CrmRealization" ADD COLUMN "branchId" TEXT;
ALTER TABLE "WorkOrderItem" ADD COLUMN "branchId" TEXT;
ALTER TABLE "Photo" ADD COLUMN "branchId" TEXT;
ALTER TABLE "NavigationTarget" ADD COLUMN "clientBranchId" TEXT;

-- CreateIndex
CREATE INDEX "CrmOrder_agencyClientId_idx" ON "CrmOrder"("agencyClientId");
CREATE INDEX "CrmOrder_branchId_idx" ON "CrmOrder"("branchId");
CREATE INDEX "CrmRealization_branchId_idx" ON "CrmRealization"("branchId");
CREATE INDEX "WorkOrderItem_branchId_idx" ON "WorkOrderItem"("branchId");
CREATE INDEX "Photo_branchId_idx" ON "Photo"("branchId");
CREATE INDEX "NavigationTarget_clientBranchId_idx" ON "NavigationTarget"("clientBranchId");

-- AddForeignKey
ALTER TABLE "CrmOrder" ADD CONSTRAINT "CrmOrder_agencyClientId_fkey" FOREIGN KEY ("agencyClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmRealization" ADD CONSTRAINT "CrmRealization_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "ClientBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "ClientBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "ClientBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NavigationTarget" ADD CONSTRAINT "NavigationTarget_clientBranchId_fkey" FOREIGN KEY ("clientBranchId") REFERENCES "ClientBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
