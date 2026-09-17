import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('additive migration enforces tenant event keys, idempotency and immediate offboarding in PostgreSQL', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TYPE "AuditAction" AS ENUM ('ACCOUNT_CREATED');
      CREATE TABLE "Organization" (id TEXT PRIMARY KEY);
      CREATE TABLE "User" (id TEXT PRIMARY KEY, status TEXT);
      CREATE TABLE "OrganizationMember" (id TEXT PRIMARY KEY, "organizationId" TEXT, "userId" TEXT, "isActive" BOOLEAN);
      CREATE TABLE "Employee" (id TEXT PRIMARY KEY, "organizationId" TEXT, "userId" TEXT, "isActive" BOOLEAN);
      INSERT INTO "Organization" VALUES ('a'), ('b'); INSERT INTO "User" VALUES ('u', 'ACTIVE');
      INSERT INTO "OrganizationMember" VALUES ('ma','a','u',true),('mb','b','u',true);`);
    await db.exec(readFileSync(new URL('../prisma/migrations/20260916170000_planner_foundation/migration.sql', import.meta.url), 'utf8'));
    await db.exec(`INSERT INTO "CalendarConnection" (id,"organizationId","userId",provider,"providerAccountId",email,"credentialsEncrypted","updatedAt") VALUES ('ca','a','u','GOOGLE','same-account','a@example.test','encrypted',now()),('cb','b','u','GOOGLE','same-account','a@example.test','encrypted',now());
      INSERT INTO "ExternalCalendar" (id,"organizationId","connectionId","externalId",name,selected) VALUES ('ea','a','ca','same-calendar','A',true),('eb','b','cb','same-calendar','B',true);
      INSERT INTO "PlannerBlock" (id,"organizationId","userId",title,"startAt","endAt","requestKey","updatedAt") VALUES ('block','a','u','Company work',now(),now()+interval '1 hour','key',now());`);
    for (let i = 0; i < 2; i++) await db.exec(`INSERT INTO "ExternalCalendarEvent" (id,"organizationId","calendarId","externalEventId",title,"startAt","endAt",timezone) VALUES ('event-a','a','ea','google-event','A',now(),now()+interval '1 hour','UTC') ON CONFLICT ("organizationId","calendarId","externalEventId") DO UPDATE SET title='Updated';`);
    await db.exec(`INSERT INTO "ExternalCalendarEvent" (id,"organizationId","calendarId","externalEventId",title,"startAt","endAt",timezone) VALUES ('event-b','b','eb','google-event','B',now(),now()+interval '1 hour','UTC');`);
    assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM "ExternalCalendarEvent"')).rows[0].count, 2);
    await assert.rejects(db.exec(`INSERT INTO "ExternalCalendarEvent" (id,"organizationId","calendarId","externalEventId",title,"startAt","endAt",timezone) VALUES ('bad','a','eb','foreign','Leak',now(),now()+interval '1 hour','UTC');`));
    await db.exec(`UPDATE "OrganizationMember" SET "isActive"=false WHERE id='ma';`);
    assert.deepEqual((await db.query('SELECT id FROM "ExternalCalendarEvent" ORDER BY id')).rows, [{ id: 'event-b' }]);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM "CalendarConnection" WHERE id=\'ca\'')).rows[0].status, 'REVOKED');
    assert.equal((await db.query('SELECT id FROM "PlannerBlock"')).rows.length, 1);
    await assert.rejects(db.exec(`UPDATE "CalendarConnection" SET status='CONNECTED' WHERE id='ca';`), /membership is inactive/);
    await db.exec(`UPDATE "OrganizationMember" SET "isActive"=true WHERE id='ma';`);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM "CalendarConnection" WHERE id=\'ca\'')).rows[0].status, 'REVOKED');
    await db.exec(`DELETE FROM "OrganizationMember" WHERE id='mb';`);
    assert.equal((await db.query('SELECT id FROM "ExternalCalendarEvent"')).rows.length, 0);
    await db.exec(`UPDATE "CalendarConnection" SET status='CONNECTED' WHERE id='ca';
      INSERT INTO "Employee" VALUES ('emp','a','u',true);
      UPDATE "Employee" SET "isActive"=false WHERE id='emp';`);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM "CalendarConnection" WHERE id=\'ca\'')).rows[0].status, 'REVOKED');
    await assert.rejects(db.exec(`UPDATE "CalendarConnection" SET status='CONNECTED' WHERE id='ca';`), /employee is inactive/);
    await db.exec(`UPDATE "Employee" SET "isActive"=true WHERE id='emp';
      UPDATE "CalendarConnection" SET status='CONNECTED' WHERE id='ca';
      UPDATE "User" SET status='SUSPENDED' WHERE id='u';`);
    assert.equal((await db.query<{ status: string }>('SELECT status FROM "CalendarConnection" WHERE id=\'ca\'')).rows[0].status, 'REVOKED');
    await assert.rejects(db.exec(`UPDATE "CalendarConnection" SET status='CONNECTED' WHERE id='ca';`), /owner is inactive/);
  } finally { await db.close(); }
});
