import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
test('actual additive migration preserves historic photos/status; backfill repeats safely; cross-tenant steps rejected', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TYPE "FieldPlanStatus" AS ENUM ('DRAFT','APPROVED','ACTIVE','COMPLETED','CANCELLED');
      CREATE TYPE "PhotoType" AS ENUM ('CONTROL','AFTER_INSTALLATION','AFTER_DEINSTALLATION');
      CREATE TABLE "Vehicle" (id TEXT PRIMARY KEY);
      CREATE TABLE "Photo" (id TEXT PRIMARY KEY, "organizationId" TEXT, "electionRemovalPointId" TEXT, content TEXT);
      CREATE TABLE "ElectionCampaign" (id TEXT PRIMARY KEY);
      CREATE TABLE "ElectionRemovalPoint" (id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, description TEXT, status TEXT);
      INSERT INTO "ElectionRemovalPoint" VALUES ('old','org','[Operace: Jiná práce] původní text','COMPLETED'),('ambiguous','org','Převoz někam','PENDING');
      INSERT INTO "Photo" VALUES ('photo','org','old','original-bytes');`);
    const sql = readFileSync('prisma/migrations/20261012150000_field_work_steps/migration.sql','utf8');
    await db.exec(sql);
    const repeatable = sql.slice(sql.indexOf('UPDATE "ElectionRemovalPoint"'));
    await db.exec(repeatable);
    assert.deepEqual((await db.query('SELECT id,status,"operationType","reviewRequired" FROM "ElectionRemovalPoint" ORDER BY id')).rows,
      [{ id: 'ambiguous', status: 'PENDING', operationType: null, reviewRequired: true }, { id: 'old', status: 'COMPLETED', operationType: 'OTHER', reviewRequired: true }]);
    assert.deepEqual((await db.query('SELECT content,"electionRemovalPointId" FROM "Photo"')).rows,[{content:'original-bytes', electionRemovalPointId:'old'}]);
    await assert.rejects(db.exec(`INSERT INTO "FieldWorkStep" (id,"organizationId","pointId",sequence,kind,label,latitude,longitude,"serviceMinutes",quantity,"updatedAt") VALUES ('foreign','other','old',1,'WORK','x',50,14,10,1,now());`), /foreign key/i);
    assert.equal((await db.query('SELECT * FROM "FieldWorkStep"')).rows.length,0);
  } finally { await db.close(); }
});
