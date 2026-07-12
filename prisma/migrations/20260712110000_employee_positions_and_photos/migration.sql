ALTER TYPE "PhotoType" ADD VALUE 'EMPLOYEE_PROFILE';
ALTER TABLE "Employee" ADD COLUMN "positions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "Employee" SET "positions" = ARRAY["position"] WHERE "position" IS NOT NULL AND btrim("position") <> '';
ALTER TABLE "Photo" ADD COLUMN "employeeId" TEXT;
CREATE INDEX "Photo_employeeId_idx" ON "Photo"("employeeId");
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
