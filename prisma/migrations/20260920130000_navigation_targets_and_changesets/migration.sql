-- CreateEnum
CREATE TYPE "NavigationChangeSetStatus" AS ENUM ('PENDING', 'APPLIED', 'REJECTED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "NavigationTarget" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL DEFAULT current_setting('app.current_organization_id'::text, true),
    "stableKey" TEXT NOT NULL,
    "navigationOfferId" TEXT,
    "navigationOrderId" TEXT,
    "sourceOfferTargetId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "photoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NavigationTarget_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "NavigationPoint" ADD COLUMN "stableKey" TEXT,
ADD COLUMN "sourceOfferPointKey" TEXT,
ADD COLUMN "sourceOfferPointId" TEXT,
ADD COLUMN "navigationTargetId" TEXT;

-- CreateTable
CREATE TABLE "NavigationChangeSet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL DEFAULT current_setting('app.current_organization_id'::text, true),
    "offerId" TEXT NOT NULL,
    "crmOrderId" TEXT NOT NULL,
    "navigationOrderId" TEXT NOT NULL,
    "status" "NavigationChangeSetStatus" NOT NULL DEFAULT 'PENDING',
    "diff" JSONB NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NavigationChangeSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NavigationTarget_navigationOfferId_sortOrder_idx" ON "NavigationTarget"("navigationOfferId", "sortOrder");
CREATE INDEX "NavigationTarget_navigationOrderId_sortOrder_idx" ON "NavigationTarget"("navigationOrderId", "sortOrder");
CREATE INDEX "NavigationTarget_organizationId_idx" ON "NavigationTarget"("organizationId");
CREATE INDEX "NavigationTarget_stableKey_idx" ON "NavigationTarget"("stableKey");
CREATE INDEX "NavigationTarget_sourceOfferTargetId_idx" ON "NavigationTarget"("sourceOfferTargetId");

-- CreateIndex
CREATE INDEX "NavigationPoint_stableKey_idx" ON "NavigationPoint"("stableKey");
CREATE INDEX "NavigationPoint_sourceOfferPointKey_idx" ON "NavigationPoint"("sourceOfferPointKey");
CREATE INDEX "NavigationPoint_navigationTargetId_idx" ON "NavigationPoint"("navigationTargetId");

-- CreateIndex
CREATE INDEX "NavigationChangeSet_navigationOrderId_status_idx" ON "NavigationChangeSet"("navigationOrderId", "status");
CREATE INDEX "NavigationChangeSet_crmOrderId_idx" ON "NavigationChangeSet"("crmOrderId");
CREATE INDEX "NavigationChangeSet_offerId_idx" ON "NavigationChangeSet"("offerId");
CREATE INDEX "NavigationChangeSet_organizationId_idx" ON "NavigationChangeSet"("organizationId");

-- AddForeignKey
ALTER TABLE "NavigationTarget" ADD CONSTRAINT "NavigationTarget_navigationOfferId_fkey" FOREIGN KEY ("navigationOfferId") REFERENCES "NavigationOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NavigationTarget" ADD CONSTRAINT "NavigationTarget_navigationOrderId_fkey" FOREIGN KEY ("navigationOrderId") REFERENCES "NavigationOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NavigationTarget" ADD CONSTRAINT "NavigationTarget_sourceOfferTargetId_fkey" FOREIGN KEY ("sourceOfferTargetId") REFERENCES "NavigationTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NavigationPoint" ADD CONSTRAINT "NavigationPoint_navigationTargetId_fkey" FOREIGN KEY ("navigationTargetId") REFERENCES "NavigationTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NavigationChangeSet" ADD CONSTRAINT "NavigationChangeSet_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NavigationChangeSet" ADD CONSTRAINT "NavigationChangeSet_crmOrderId_fkey" FOREIGN KEY ("crmOrderId") REFERENCES "CrmOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NavigationChangeSet" ADD CONSTRAINT "NavigationChangeSet_navigationOrderId_fkey" FOREIGN KEY ("navigationOrderId") REFERENCES "NavigationOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NavigationChangeSet" ADD CONSTRAINT "NavigationChangeSet_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill stableKey for existing NavigationPoint rows
UPDATE "NavigationPoint" SET "stableKey" = id WHERE "stableKey" IS NULL;
