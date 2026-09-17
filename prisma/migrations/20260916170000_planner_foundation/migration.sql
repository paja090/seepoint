-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PLANNER_CHANGED';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "plannerDefaults" JSONB;

-- CreateTable
CREATE TABLE "CalendarConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "credentialsEncrypted" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "syncStatus" TEXT NOT NULL DEFAULT 'IDLE',
    "syncLeaseUntil" TIMESTAMP(3),
    "syncLeaseId" TEXT,
    "retryAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalCalendar" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Prague',
    "kind" TEXT NOT NULL DEFAULT 'PERSONAL',
    "visibility" TEXT NOT NULL DEFAULT 'FREE_BUSY',
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "syncToken" TEXT,
    "fullSyncedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "ExternalCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalCalendarEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "busy" BOOLEAN NOT NULL DEFAULT true,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "location" TEXT,
    "etag" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerPreferences" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannerBlock" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'FOCUS',
    "sourceKind" TEXT,
    "sourceId" TEXT,
    "requestKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannerBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarConnection_organizationId_userId_status_idx" ON "CalendarConnection"("organizationId", "userId", "status");

-- CreateIndex
CREATE INDEX "CalendarConnection_retryAt_lastSyncAt_idx" ON "CalendarConnection"("retryAt", "lastSyncAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnection_organizationId_userId_provider_providerA_key" ON "CalendarConnection"("organizationId", "userId", "provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnection_organizationId_id_key" ON "CalendarConnection"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalCalendar_organizationId_connectionId_externalId_key" ON "ExternalCalendar"("organizationId", "connectionId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalCalendar_organizationId_id_key" ON "ExternalCalendar"("organizationId", "id");

-- CreateIndex
CREATE INDEX "ExternalCalendarEvent_organizationId_startAt_endAt_idx" ON "ExternalCalendarEvent"("organizationId", "startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalCalendarEvent_organizationId_calendarId_externalEve_key" ON "ExternalCalendarEvent"("organizationId", "calendarId", "externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "PlannerPreferences_organizationId_userId_key" ON "PlannerPreferences"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "PlannerBlock_organizationId_userId_startAt_endAt_idx" ON "PlannerBlock"("organizationId", "userId", "startAt", "endAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlannerBlock_organizationId_userId_requestKey_key" ON "PlannerBlock"("organizationId", "userId", "requestKey");

-- AddForeignKey
ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendar" ADD CONSTRAINT "ExternalCalendar_organizationId_connectionId_fkey" FOREIGN KEY ("organizationId", "connectionId") REFERENCES "CalendarConnection"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalCalendarEvent" ADD CONSTRAINT "ExternalCalendarEvent_organizationId_calendarId_fkey" FOREIGN KEY ("organizationId", "calendarId") REFERENCES "ExternalCalendar"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerPreferences" ADD CONSTRAINT "PlannerPreferences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannerBlock" ADD CONSTRAINT "PlannerBlock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Business blocks deliberately survive membership removal. Provider data does not.
ALTER TABLE "PlannerBlock" ADD CONSTRAINT "PlannerBlock_interval_check" CHECK ("endAt" > "startAt");
ALTER TABLE "ExternalCalendarEvent" ADD CONSTRAINT "ExternalCalendarEvent_interval_check" CHECK ("endAt" > "startAt");
ALTER TABLE "ExternalCalendar" ADD CONSTRAINT "ExternalCalendar_visibility_check" CHECK ("visibility" IN ('FREE_BUSY', 'WORK_DETAILS', 'FULL'));
ALTER TABLE "ExternalCalendar" ADD CONSTRAINT "ExternalCalendar_kind_check" CHECK ("kind" IN ('PERSONAL', 'COMPANY'));
ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_status_check" CHECK ("status" IN ('CONNECTED', 'ERROR', 'REVOKED'));

-- Covers every existing offboarding route, including direct membership removal.
-- Revocation payload stays encrypted until the existing cron infrastructure retries Google.
CREATE FUNCTION planner_offboard(org TEXT, uid TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "CalendarConnection" SET "status" = 'REVOKED', "syncStatus" = 'IDLE',
    "syncLeaseId" = NULL, "syncLeaseUntil" = NULL, "retryAt" = NULL,
    "errorCode" = 'REVOCATION_PENDING', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "organizationId" = org AND "userId" = uid;
  DELETE FROM "ExternalCalendarEvent" e USING "ExternalCalendar" c, "CalendarConnection" x
    WHERE e."calendarId" = c.id AND e."organizationId" = org
      AND c."connectionId" = x.id AND c."organizationId" = org
      AND x."organizationId" = org AND x."userId" = uid;
  UPDATE "ExternalCalendar" c SET "selected" = false, "syncToken" = NULL
    FROM "CalendarConnection" x WHERE c."connectionId" = x.id AND c."organizationId" = org
      AND x."organizationId" = org AND x."userId" = uid;
  DELETE FROM "PlannerPreferences" WHERE "organizationId" = org AND "userId" = uid;
END;
$$;
CREATE FUNCTION planner_membership_offboard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM planner_offboard(OLD."organizationId", OLD."userId"); RETURN OLD;
  END IF;
  IF OLD."isActive" AND NOT NEW."isActive" THEN
    PERFORM planner_offboard(NEW."organizationId", NEW."userId");
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER planner_membership_offboard_trigger AFTER UPDATE OF "isActive" OR DELETE ON "OrganizationMember"
  FOR EACH ROW EXECUTE FUNCTION planner_membership_offboard();
CREATE FUNCTION planner_employee_offboard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."userId" IS NOT NULL THEN PERFORM planner_offboard(OLD."organizationId", OLD."userId"); END IF;
    RETURN OLD;
  END IF;
  IF OLD."isActive" AND NOT NEW."isActive" AND NEW."userId" IS NOT NULL THEN
    PERFORM planner_offboard(NEW."organizationId", NEW."userId");
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER planner_employee_offboard_trigger AFTER UPDATE OF "isActive" OR DELETE ON "Employee"
  FOR EACH ROW EXECUTE FUNCTION planner_employee_offboard();
CREATE FUNCTION planner_user_offboard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE org TEXT;
BEGIN
  IF OLD.status = 'ACTIVE' AND NEW.status <> 'ACTIVE' THEN
    FOR org IN SELECT DISTINCT "organizationId" FROM "CalendarConnection" WHERE "userId" = NEW.id LOOP
      PERFORM planner_offboard(org, NEW.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER planner_user_offboard_trigger AFTER UPDATE OF status ON "User"
  FOR EACH ROW EXECUTE FUNCTION planner_user_offboard();

-- Serialize OAuth activation with membership/user/employee offboarding. Without
-- these locks a callback could insert a connection after the offboard trigger ran.
CREATE FUNCTION planner_connection_owner_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE employee_active BOOLEAN;
BEGIN
  IF NEW.status <> 'CONNECTED' THEN RETURN NEW; END IF;
  PERFORM id FROM "User" WHERE id = NEW."userId" AND status = 'ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Planner owner is inactive'; END IF;
  FOR employee_active IN SELECT "isActive" FROM "Employee"
    WHERE "organizationId" = NEW."organizationId" AND "userId" = NEW."userId" FOR SHARE LOOP
    IF NOT employee_active THEN RAISE EXCEPTION 'Planner employee is inactive'; END IF;
  END LOOP;
  PERFORM id FROM "OrganizationMember" WHERE "organizationId" = NEW."organizationId"
    AND "userId" = NEW."userId" AND "isActive" FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Planner membership is inactive'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER planner_connection_owner_guard_trigger BEFORE INSERT OR UPDATE OF status ON "CalendarConnection"
  FOR EACH ROW EXECUTE FUNCTION planner_connection_owner_guard();
